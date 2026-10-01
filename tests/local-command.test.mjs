import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { slugForDir } from "../lib/paths.mjs";
import { formatBorderedTable } from "../lib/format.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = path.join(ROOT, "scripts", "local-command.mjs");
const ID = "11111111-1111-4111-8111-111111111111";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "franko-local-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cwd = path.join(root, "project");
  fs.mkdirSync(cwd);
  const dir = path.join(root, "projects", slugForDir(cwd));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${ID}.jsonl`);
  fs.writeFileSync(file, `${JSON.stringify({ type: "user", cwd, message: { content: "Local fixture session" } })}\n`);
  return { root, cwd, dir, file };
}

function invoke(f, command, args = "", extra = {}) {
  const input = {
    hook_event_name: "UserPromptExpansion", command_name: `franko:${command}`,
    command_args: args, command_source: "plugin", cwd: f.cwd,
    ...extra,
  };
  const result = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify(input), encoding: "utf8",
    env: { ...process.env, CLAUDE_CONFIG_DIR: f.root, CLAUDE_CODE_PATH: "must-not-launch-claude" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  if (!result.stdout) return null;
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "block", "Every handled command must stop before reaching the model");
  return output.reason;
}

test("all six commands run locally; details and rename preserve list numbering", (t) => {
  const f = fixture(t);
  assert.match(invoke(f, "help"), /\/franko:list/);
  const table = invoke(f, "list", "--project");
  assert.match(table, /\+---/);
  assert.match(table, /Local fixture session/);
  assert.match(table, /\/franko:details/);
  const snapshot = fs.readFileSync(path.join(f.root, "franko", "last-list.json"), "utf8");
  assert.match(invoke(f, "details", "1"), new RegExp(ID));
  assert.match(invoke(f, "rename", '1 "Login refactoring"'), /Renamed session/);
  assert.equal(fs.readFileSync(path.join(f.root, "franko", "last-list.json"), "utf8"), snapshot);
  assert.match(invoke(f, "search", '"Login refactoring"'), /Login refactoring/);
  assert.match(invoke(f, "resume", "1"), new RegExp(`/resume ${ID}`));
  assert.match(invoke(f, "details", '"Login refactoring"'), new RegExp(ID));
});

test("search filters before limiting and details can resolve older matches", (t) => {
  const f = fixture(t);
  fs.utimesSync(f.file, new Date(1000), new Date(1000));
  for (let index = 0; index < 12; index += 1) {
    fs.writeFileSync(path.join(f.dir, `new-${index}.jsonl`), `${JSON.stringify({ type: "user", cwd: f.cwd, message: { content: `Newer conversation ${index}` } })}\n`);
  }
  assert.match(invoke(f, "search", '"Local fixture" --limit 1'), /Local fixture session/);
  const detail = invoke(f, "details", "1");
  assert.match(detail, new RegExp(ID));
  assert.doesNotMatch(detail, /undefined|NaN/);
});

test("empty or out-of-range snapshots never select an unrelated session", (t) => {
  const f = fixture(t);
  assert.match(invoke(f, "search", "no-such-topic"), /No conversations found/);
  assert.match(invoke(f, "resume", "1"), /Session not found/);
  assert.match(invoke(f, "rename", "1 Wrong session"), /Session not found/);
  assert.equal(fs.existsSync(path.join(f.root, "franko", "aliases.json")), false);
  invoke(f, "list");
  assert.match(invoke(f, "details", "2"), /Session not found/);
});

test("argument errors stop locally without falling through to the model", (t) => {
  const f = fixture(t);
  for (const [command, args, expected] of [
    ["details", "", /Invalid arguments/],
    ["search", "", /Usage/],
    ["rename", "1", /Invalid arguments/],
    ["resume", "1 --clip", /Invalid arguments/],
    ["list", "--unknown", /Unknown option/],
    ["list", "--limit bad", /integer from 1 to 300/],
    ["list", "--limit 0", /integer from 1 to 300/],
    ["list", "--limit 301", /integer from 1 to 300/],
    ["search", '"unclosed', /Unclosed quote/],
  ]) assert.match(invoke(f, command, args), expected);
});

test("shell syntax in names is literal, not executed", (t) => {
  const f = fixture(t);
  invoke(f, "list");
  const name = "Login $(whoami); & | %USERNAME% C:\\work";
  invoke(f, "rename", `1 "${name}"`);
  const aliases = JSON.parse(fs.readFileSync(path.join(f.root, "franko", "aliases.json"), "utf8"));
  assert.equal(aliases[ID], name);
});

test("unrelated commands and ordinary prompts pass through untouched", (t) => {
  const f = fixture(t);
  assert.equal(invoke(f, "list", "", { command_name: "other:list" }), null);
  assert.equal(invoke(f, "list", "", { command_name: "list" }), null);
  assert.equal(invoke(f, "list", "", { hook_event_name: "UserPromptSubmit", prompt: "Explain this code" }), null);
});

test("local filesystem failures also stop before the model", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "franko"), "Not a directory");
  assert.match(invoke(f, "list"), /EEXIST|ENOTDIR|Local command failed/);
});

test("bordered table retains five columns and literal single-line cells", () => {
  const table = formatBorderedTable([{
    sessionId: ID, name: "Long title ".repeat(10), projectLabel: "Demo\nproject",
    mtimeMs: 0, tokens: 1234,
  }], { now: 3600000 });
  const lines = table.split("\n");
  assert.equal(new Set(lines.map((line) => line.length)).size, 1);
  assert.match(table, /Title.*Project.*Last activity.*Tokens/);
  assert.match(table, /Demo project/);
  assert.match(table, /1h ago.*1k/);
  assert.match(formatBorderedTable([]), /No conversations found/);
});
