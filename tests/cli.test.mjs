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

function writeTranscript(configDir, projectSlug, sessionId, entries) {
  const dir = path.join(configDir, "projects", projectSlug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
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
