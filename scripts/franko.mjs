#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pickGreeting } from "../lib/greetings.mjs";
import { listSessions } from "../lib/sessions.mjs";
import { buildRecapMessage, formatBorderedTable, formatDetail, formatMarkdownTable, formatTable } from "../lib/format.mjs";
import { applyAliases, readAliases, readSnapshot, writeAliases, writeSnapshot } from "../lib/state.mjs";
import { filterSessions, parsePickerCommand } from "../lib/picker.mjs";

const STEP_BY_SOURCE = {
  startup: "startup",
  resume: "resume",
  clear: "clear",
};

const LIST_FOOTER =
  "Resume: franko <number> · Details: franko details <number> · Picker: franko · JSON: franko list --json";
const PICKER_FOOTER = "Number + Enter: resume · d 2: details · r 2: rename · /text: search · q: quit";

const HELP = `franko - the punctual colleague for Claude Code

Usage:
  franko                          Open the local picker (no Claude tokens)
  franko help                     Show this help
  franko list [options]           List recent conversations from every project
  franko details <number|name>    Show title, project, consumption and prompts
  franko search <text>            Search conversations and number the results
  franko resume <number|name>     Resume a session (runs claude --resume)
  franko rename <number|name> <new name>
  franko command <number|name>    Print the resume command (--clip to copy it)
  franko <number>                 Shortcut for resume
  franko hook                     SessionStart hook mode (reads JSON from stdin)

List and search options:
  --project   Current project only
  --all       Include conversations without real content
  --limit N   Number of conversations (default 10)
  --md        Markdown table output
  --json      JSON output

Aliases kept for compatibility: detail (details), open (resume), rinomina (rename).
`;

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function loadSessions(options = {}) {
  const aliases = readAliases(options.configDir, options.env);
  return applyAliases(listSessions(options), aliases);
}

function runHook() {
  try {
    const input = parseJson(readStdin());
    const step = STEP_BY_SOURCE[input.source] || "startup";
    const sessions = loadSessions({ limit: 10 });
    const message = buildRecapMessage({
      sessions,
      greeting: pickGreeting(step),
      recapIntro: pickGreeting("recap"),
      emptyPhrase: pickGreeting("empty"),
    });
    emit({ systemMessage: message });
  } catch {
    emit({ systemMessage: pickGreeting("error") });
  }
  process.exitCode = 0;
}

function parseListArgs(args) {
  const options = { limit: 10, json: false, markdown: false, projectDir: undefined, includeEmpty: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--project") {
      options.projectDir = process.cwd();
    } else if (arg === "--all") {
      options.includeEmpty = true;
    } else if (arg === "--limit") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) options.limit = Math.floor(value);
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--md") {
      options.markdown = true;
    } else if (arg === "--chat") {
      options.chat = true;
    }
  }
  return options;
}

function parseSearchArgs(args) {
  const options = parseListArgs(args);
  const terms = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") {
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) continue;
    terms.push(arg);
  }
  options.query = terms.join(" ").trim();
  return options;
}

function outputSessions(sessions, options, footer) {
  if (options.chat) {
    process.stdout.write(`${formatBorderedTable(sessions)}\n\nDetails: /franko:details <number>\nResume: /franko:resume <number>\nSearch: /franko:search <text>\n`);
    return;
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
    return;
  }
  if (options.markdown) {
    process.stdout.write(`${formatMarkdownTable(sessions)}\n`);
    if (footer) process.stdout.write(`\n${footer}\n`);
    return;
  }
  process.stdout.write(`${formatTable(sessions, { footer })}\n`);
}

function runList(args) {
  const options = parseListArgs(args);
  const sessions = loadSessions(options);
  writeSnapshot(sessions, options.configDir, options.env);
  outputSessions(sessions, options, LIST_FOOTER);
}

function runSearch(args) {
  const options = parseSearchArgs(args);
  if (!options.query) {
    process.stderr.write("Usage: franko search <text>\n");
    process.exitCode = 1;
    return;
  }
  const sessions = filterSessions(loadSessions({ ...options, limit: 300, parseLimit: 300 }), options.query)
    .slice(0, options.limit);
  writeSnapshot(sessions, options.configDir, options.env);
  outputSessions(sessions, options, LIST_FOOTER);
}

function resolveReference(ref, options = {}) {
  const aliases = readAliases(options.configDir, options.env);
  const sessions = applyAliases(listSessions({ ...options, includeEmpty: true, limit: 300, parseLimit: 300 }), aliases);
  if (/^\d+$/.test(ref)) {
    const index = Number(ref) - 1;
    const snapshot = readSnapshot(options.configDir, options.env);
    const entry = snapshot && snapshot.sessions ? snapshot.sessions[index] : null;
    if (entry) {
      return (
        sessions.find((session) => session.sessionId === entry.sessionId) || {
          sessionId: entry.sessionId,
          displayName: entry.displayName,
          name: entry.displayName,
        }
      );
    }
    // An existing snapshot is authoritative, including an empty search result.
    return snapshot ? null : sessions[index] || null;
  }
  const needle = ref.toLowerCase();
  return (
    sessions.find(
      (session) =>
        session.sessionId.startsWith(ref) ||
        (session.alias && session.alias.toLowerCase() === needle) ||
        (session.displayName && session.displayName.toLowerCase() === needle) ||
        (session.name && session.name.toLowerCase().includes(needle)),
    ) || null
  );
}

function findClaude() {
  const home = os.homedir();
  const candidates = [];
  if (process.env.CLAUDE_CODE_PATH) candidates.push(process.env.CLAUDE_CODE_PATH);
  if (process.platform === "win32") {
    candidates.push(path.join(home, ".local", "bin", "claude.exe"));
    candidates.push(path.join(home, ".local", "bin", "claude.cmd"));
  } else {
    candidates.push(path.join(home, ".local", "bin", "claude"));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return "claude";
}

function launchResume(sessionId) {
  const binary = findClaude();
  const result = spawnSync(binary, ["--resume", sessionId], {
    stdio: "inherit",
    shell: process.platform === "win32" && /\.cmd$/i.test(binary),
  });
  process.exitCode = typeof result.status === "number" ? result.status : 1;
}

function firstRef(args) {
  return args.find((arg) => !arg.startsWith("-")) || null;
}

function runResume(args) {
  const dryRun = args.includes("--dry-run");
  const ref = firstRef(args);
  if (!ref) {
    process.stderr.write("Usage: franko resume <number|name>\n");
    process.exitCode = 1;
    return;
  }
  const target = resolveReference(ref);
  if (!target) {
    process.stderr.write(`Session not found: ${ref}\n`);
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    process.stdout.write(`claude --resume ${target.sessionId}\n`);
    return;
  }
  launchResume(target.sessionId);
}

function runDetails(args) {
  const ref = firstRef(args);
  if (!ref) {
    process.stderr.write("Usage: franko details <number|name>\n");
    process.exitCode = 1;
    return;
  }
  const target = resolveReference(ref);
  if (!target) {
    process.stderr.write(`Session not found: ${ref}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${formatDetail(target)}\n`);
}

function runCommand(args) {
  const clip = args.includes("--clip");
  const ref = firstRef(args);
  if (!ref) {
    process.stderr.write("Usage: franko command <number|name> [--clip]\n");
    process.exitCode = 1;
    return;
  }
  const target = resolveReference(ref);
  if (!target) {
    process.stderr.write(`Session not found: ${ref}\n`);
    process.exitCode = 1;
    return;
  }
  const command = `claude --resume ${target.sessionId}`;
  process.stdout.write(`Session: ${target.displayName || target.name || target.sessionId}\n`);
  process.stdout.write(`Command: ${command}\n`);
  if (args.includes("--chat")) {
    process.stdout.write(`In Claude Code: /resume ${target.sessionId}\n`);
  }
  if (clip && process.platform === "win32") {
    const result = spawnSync("clip", [], { input: command });
    if (!result.error && result.status === 0) {
      process.stdout.write("Command copied to the clipboard: paste it in the terminal.\n");
    } else {
      process.stdout.write("Clipboard unavailable: copy the command manually.\n");
    }
  }
}

function appendCustomTitle(sessionId, name) {
  try {
    const sessions = listSessions({ includeEmpty: true, limit: 200, parseLimit: 200 });
    const session = sessions.find((item) => item.sessionId === sessionId);
    if (!session) return false;
    fs.appendFileSync(session.file, `${JSON.stringify({ type: "custom-title", customTitle: name, sessionId })}\n`);
    return true;
  } catch {
    return false;
  }
}

function renameSession(sessionId, name) {
  const aliases = readAliases();
  aliases[sessionId] = name;
  writeAliases(aliases);
  appendCustomTitle(sessionId, name);
}

function runRename(args) {
  const ref = args[0];
  const name = args.slice(1).join(" ").trim();
  if (!ref || !name) {
    process.stderr.write("Usage: franko rename <number|name> <new name>\n");
    process.exitCode = 1;
    return;
  }
  const target = resolveReference(ref);
  if (!target) {
    process.stderr.write(`Session not found: ${ref}\n`);
    process.exitCode = 1;
    return;
  }
  renameSession(target.sessionId, name);
  process.stdout.write(`Renamed session: "${name}" -> ${target.sessionId}\n`);
}

async function runPicker() {
  const readline = await import("node:readline/promises");
  let sessions = loadSessions({ limit: 20 }).map((session, index) => ({ ...session, number: index + 1 }));
  if (sessions.length === 0) {
    process.stdout.write("No conversations found.\n");
    return;
  }
  writeSnapshot(sessions);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let query = "";
  try {
    for (;;) {
      const visible = filterSessions(sessions, query);
      process.stdout.write(`\n${formatTable(visible, { footer: PICKER_FOOTER })}\n`);
      if (query) process.stdout.write(`Active filter: /${query}\n`);
      const answer = await rl.question("Choice: ");
      const command = parsePickerCommand(answer, 100000);
      if (command.type === "quit") break;
      if (command.type === "list") {
        query = "";
        continue;
      }
      if (command.type === "search") {
        query = command.query;
        continue;
      }
      if (command.type === "invalid") {
        process.stdout.write(`${command.reason}\n`);
        continue;
      }
      const session = visible.find((item) => item.number === command.index + 1);
      if (!session) {
        process.stdout.write("number out of range\n");
        continue;
      }
      if (command.type === "detail") {
        process.stdout.write(`\n${formatDetail(session)}\n`);
        continue;
      }
      if (command.type === "rename") {
        renameSession(session.sessionId, command.name);
        const aliases = readAliases();
        sessions = applyAliases(sessions, aliases).map((item, index) => ({ ...item, number: index + 1 }));
        process.stdout.write(`Renamed: "${command.name}"\n`);
        continue;
      }
      if (command.type === "open") {
        rl.close();
        launchResume(session.sessionId);
        return;
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const [requested, ...rest] = process.argv.slice(2);
  if (requested === "--help" || requested === "-h" || requested === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (requested === "hook") return runHook();
  if (requested === "list") return runList(rest);
  if (requested === "search") return runSearch(rest);
  if (requested === "detail" || requested === "details") return runDetails(rest);
  if (requested === "open" || requested === "resume") return runResume(rest);
  if (requested === "command") return runCommand(rest);
  if (requested === "rinomina" || requested === "rename") return runRename(rest);
  if (requested === "pick") return runPicker();
  if (!requested) {
    if (process.stdin.isTTY) return runPicker();
    return runList(rest);
  }
  if (requested.startsWith("-")) return runList(process.argv.slice(2));
  if (/^\d+$/.test(requested)) return runResume([requested, ...rest]);
  return runList([requested, ...rest]);
}

main();
