#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./franko.mjs", import.meta.url));
const COMMANDS = new Set(["help", "list", "details", "search", "rename", "resume"]);
const HELP = `FRANKO · Local commands

/franko:list [--project] [--all] [--limit N]
/franko:search <text> [--project] [--limit N]
/franko:details <number|"name">
/franko:rename <number|"name"> <new name>
/franko:resume <number|"name">
/franko:help

Numbers refer to the last list or search. Quote names containing spaces.
Resume prepares /resume <id>; run it yourself to switch conversations.
These explicit commands run locally, without a model call.
Natural-language requests to Claude still use tokens.`;

// Split arguments without evaluating shell syntax. Preserve Windows backslashes.
function splitArguments(text) {
  const args = [];
  let word = "";
  let quote = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) args.push(word);
      word = "";
      started = false;
    } else {
      word += char;
      started = true;
    }
  }
  if (quote) throw new Error("Unclosed quote in arguments.");
  if (started) args.push(word);
  return args;
}

function validateArguments(command, args) {
  if (command === "list" || command === "search") {
    const terms = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (["--project", "--all", "--md", "--json"].includes(arg)) continue;
      if (arg === "--limit") {
        const value = args[++index];
        if (!/^\d+$/.test(value || "") || Number(value) < 1 || Number(value) > 300) {
          throw new Error("--limit must be an integer from 1 to 300.");
        }
      } else if (arg.startsWith("-")) {
        throw new Error(`Unknown option: ${arg}`);
      } else {
        terms.push(arg);
      }
    }
    if (command === "list" && terms.length) throw new Error("Usage: /franko:list [--project] [--all] [--limit N]");
    if (command === "search" && !terms.join(" ").trim()) throw new Error("Usage: /franko:search <text>");
    return;
  }
  if (command === "help" && args.length === 0) return;
  if (["details", "resume"].includes(command) && args.length === 1 && args[0] && !args[0].startsWith("-")) return;
  if (command === "rename" && args.length >= 2 && args[0] && !args[0].startsWith("-") && args.slice(1).join(" ").trim()) return;
  throw new Error(`Invalid arguments for /franko:${command}. See /franko:help.`);
}

function run(input) {
  if (input.hook_event_name !== "UserPromptExpansion") return null;
  const match = /^franko:(help|list|details|search|rename|resume)$/.exec(input.command_name || "");
  if (!match || !COMMANDS.has(match[1])) return null;
  const command = match[1];
  const rawArgs = input.command_args ?? "";
  if (typeof rawArgs !== "string" || rawArgs.length > 16000) throw new Error("Invalid command arguments.");
  const args = splitArguments(rawArgs);
  validateArguments(command, args);
  if (command === "help") return HELP;
  if (["list", "search"].includes(command) && !args.includes("--md") && !args.includes("--json")) args.push("--chat");
  if (command === "resume") args.push("--chat");
  // Resume only prepares the command; never start a nested Claude process.
  const cliCommand = command === "resume" ? "command" : command;
  const result = spawnSync(process.execPath, [CLI, cliCommand, ...args], {
    cwd: input.cwd || process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error(`Local command failed: ${result.error.message}`);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return output || (result.status === 0 ? "Done." : "Local command failed.");
}

let reason;
try {
  reason = run(JSON.parse(fs.readFileSync(0, "utf8")));
} catch (error) {
  reason = `Franko: ${error.message}`;
}
if (reason !== null) {
  // Blocking expansion prevents the skill prompt from reaching the model.
  process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
}
