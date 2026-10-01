import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GREETINGS } from "../lib/greetings.mjs";
import { slugForDir } from "../lib/sessions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "franko.mjs");

function tempConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "franko-cli-"));
}

function writeTranscript(configDir, projectSlug, sessionId, entries, mtimeSeconds) {
  const dir = path.join(configDir, "projects", projectSlug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.jsonl`);
  fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  if (mtimeSeconds !== undefined) {
    const date = new Date(mtimeSeconds * 1000);
    fs.utimesSync(file, date, date);
  }
}

function run(args, { configDir, input } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf8",
    input,
  });
}

function withSession() {
  const configDir = tempConfigDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "aaaaaaaa-1111", [
    {
      type: "user",
      message: { content: "sistemare il recap di franko" },
      cwd: "D:\\Progetti\\Desktop",
      gitBranch: "main",
    },
  ]);
  return configDir;
}

function withTwoSessions() {
  const configDir = withSession();
  writeTranscript(
    configDir,
    "C--Users-Nicola",
    "bbbbbbbb-2222",
    [{ type: "user", message: { content: "seconda sessione" }, cwd: "C:\\Users\\Nicola" }],
    Math.floor(Date.now() / 1000) + 60,
  );
  return configDir;
}

test("hook startup prints a systemMessage with greeting and recap", () => {
  const configDir = withSession();
  const result = run(["hook"], { configDir, input: JSON.stringify({ source: "startup" }) });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(GREETINGS.startup.some((phrase) => payload.systemMessage.includes(phrase)));
  assert.match(payload.systemMessage, /sistemare il recap di franko/);
  assert.match(payload.systemMessage, /\/franko:recenti/);
});

test("hook maps resume and clear sources", () => {
  const configDir = withSession();
  const resume = JSON.parse(run(["hook"], { configDir, input: JSON.stringify({ source: "resume" }) }).stdout);
  assert.ok(GREETINGS.resume.some((phrase) => resume.systemMessage.includes(phrase)));
  const clear = JSON.parse(run(["hook"], { configDir, input: JSON.stringify({ source: "clear" }) }).stdout);
  assert.ok(GREETINGS.clear.some((phrase) => clear.systemMessage.includes(phrase)));
});

test("hook reports an empty archive with exit code 0", () => {
  const configDir = tempConfigDir();
  const result = run(["hook"], { configDir, input: JSON.stringify({ source: "startup" }) });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(GREETINGS.empty.some((phrase) => payload.systemMessage.includes(phrase)));
});

test("hook tolerates invalid stdin", () => {
  const configDir = withSession();
  const result = run(["hook"], { configDir, input: "not json at all" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(GREETINGS.startup.some((phrase) => payload.systemMessage.includes(phrase)));
});

test("list prints resume commands and supports --json", () => {
  const configDir = withSession();
  const text = run(["list"], { configDir });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /claude --resume aaaaaaaa-1111/);
  assert.ok(GREETINGS.list.some((phrase) => text.stdout.includes(phrase)));
  const json = run(["list", "--json"], { configDir });
  assert.equal(json.status, 0, json.stderr);
  const sessions = JSON.parse(json.stdout);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, "aaaaaaaa-1111");
});

test("list --project filters to the current directory", () => {
  const configDir = withSession();
  const projectSlug = slugForDir(ROOT);
  writeTranscript(configDir, projectSlug, "cccccccc-3333", [
    { type: "user", message: { content: "sessione del plugin" }, cwd: ROOT },
  ]);
  const result = run(["list", "--project", "--json"], { configDir });
  assert.equal(result.status, 0, result.stderr);
  const sessions = JSON.parse(result.stdout);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].projectSlug, projectSlug);
});

test("list --limit caps the number of sessions", () => {
  const configDir = tempConfigDir();
  for (let index = 0; index < 3; index += 1) {
    writeTranscript(configDir, "D--Progetti-Desktop", `dddddddd-000${index}`, [
      { type: "user", message: { content: `richiesta ${index}` }, cwd: "D:\\Progetti\\Desktop" },
    ]);
  }
  const result = run(["list", "--limit", "2", "--json"], { configDir });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).length, 2);
});

test("list writes a snapshot and open <n> --dry-run resolves numbers", () => {
  const configDir = withTwoSessions();
  const listed = run(["list", "--json"], { configDir });
  assert.equal(listed.status, 0, listed.stderr);
  const sessions = JSON.parse(listed.stdout);
  assert.equal(sessions.length, 2);
  const open = run(["open", "1", "--dry-run"], { configDir });
  assert.equal(open.status, 0, open.stderr);
  assert.equal(open.stdout.trim(), `claude --resume ${sessions[0].sessionId}`);
});

test("bare number is a shortcut for open", () => {
  const configDir = withSession();
  run(["list"], { configDir });
  const result = run(["1", "--dry-run"], { configDir });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^claude --resume /);
});

test("command prints the resume command", () => {
  const configDir = withSession();
  run(["list"], { configDir });
  const result = run(["command", "1"], { configDir });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /claude --resume aaaaaaaa-1111/);
});

test("rinomina stores an alias shown by list", () => {
  const configDir = withSession();
  run(["list"], { configDir });
  const rename = run(["rinomina", "1", "Fix", "del", "parser"], { configDir });
  assert.equal(rename.status, 0, rename.stderr);
  const aliases = JSON.parse(fs.readFileSync(path.join(configDir, "franko", "aliases.json"), "utf8"));
  assert.equal(aliases["aaaaaaaa-1111"], "Fix del parser");
  const list = run(["list"], { configDir });
  assert.match(list.stdout, /Fix del parser/);
});
