#!/usr/bin/env node
import fs from "node:fs";
import { pickGreeting } from "../lib/greetings.mjs";
import { listSessions } from "../lib/sessions.mjs";
import { buildRecapMessage, formatList } from "../lib/format.mjs";

const STEP_BY_SOURCE = {
  startup: "startup",
  resume: "resume",
  clear: "clear",
};

const HELP = `franko - il collega preciso di Claude Code

Uso:
  franko.mjs hook            Modalità hook SessionStart (legge JSON da stdin)
  franko.mjs list [opzioni]  Elenca le ultime sessioni, tutti i progetti

Opzioni di list:
  --project   Solo il progetto corrente
  --all       Tutti i progetti (predefinito)
  --limit N   Numero di sessioni (predefinito 10)
  --json      Output JSON
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

function runHook() {
  try {
    const input = parseJson(readStdin());
    const step = STEP_BY_SOURCE[input.source] || "startup";
    const sessions = listSessions({ limit: 10 });
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
  const options = { limit: 10, json: false, projectDir: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--project") {
      options.projectDir = process.cwd();
    } else if (arg === "--all") {
      options.projectDir = undefined;
    } else if (arg === "--limit") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) options.limit = Math.floor(value);
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    }
  }
  return options;
}

function runList(args) {
  const options = parseListArgs(args);
  const sessions = listSessions(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${formatList(sessions, pickGreeting("list"))}\n`);
}

function main() {
  let args = process.argv.slice(2);
  let command;

  if (args[0] === "hook" || args[0] === "list") {
    command = args[0];
    args = args.slice(1);
  } else if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(HELP);
    return;
  } else if ((args.length === 0 && process.stdin.isTTY) || (args[0] && args[0].startsWith("-"))) {
    command = "list";
  } else {
    command = "hook";
  }

  if (command === "list") runList(args);
  else runHook();
}

main();
