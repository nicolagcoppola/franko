#!/usr/bin/env node
// Optional integration proof against the installed Claude Code executable.
// Use a temporary config and a local API sink; never spend real API credits.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const plugin = fileURLToPath(new URL("../", import.meta.url));
const binary = process.env.FRANKO_CLAUDE_PATH || path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
const root = fs.mkdtempSync(path.join(process.env.FRANKO_VERIFY_TMPDIR || os.tmpdir(), "franko-verify-"));
const config = path.join(root, "config");
const dir = path.join(config, "projects", "fixture");
fs.mkdirSync(dir, { recursive: true });
const id = "11111111-1111-4111-8111-111111111111";
fs.writeFileSync(path.join(dir, `${id}.jsonl`), `${JSON.stringify({
  type: "user", cwd: root, message: { content: "Local fixture conversation" },
})}\n`);

let activeChild;
let requests = [];
const isInference = (url) => /\/messages(?:\?|$)|\/complete(?:\?|$)/.test(url);
const server = http.createServer((request, response) => {
  requests.push(request.url);
  request.resume();
  response.writeHead(400, { "content-type": "application/json" });
  response.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Local verification sink; no external API." } }));
  // Stop immediately if any inference is attempted, including the control run.
  if (isInference(request.url)) activeChild?.kill();
});

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC|CLAUDE|AWS|GOOGLE|AZURE)|^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)) delete env[key];
  }
  Object.assign(env, {
    CLAUDE_CONFIG_DIR: config,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    ANTHROPIC_API_KEY: "local-verification-key-not-real",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: "false",
  });

  async function run(prompt, control = false) {
    requests = [];
    let stdout = "", stderr = "", timedOut = false;
    activeChild = spawn(binary, [
      "--plugin-dir", plugin, "--setting-sources", "user", "--strict-mcp-config",
      "--no-session-persistence", "--permission-mode", "dontAsk", "--model", "claude-sonnet-4-6",
      "--include-hook-events", "--verbose", "--output-format", "stream-json", "-p", prompt,
    ], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const child = activeChild;
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 30000);
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
    } finally {
      clearTimeout(timer);
      activeChild = null;
    }
    assert.equal(timedOut, false, `Claude Code timed out: ${prompt}`);
    const inference = requests.filter(isInference);
    if (control) {
      assert.ok(inference.length > 0, "Control must attempt inference, proving that the API sink detects it");
      console.log("PASS control: ordinary prompt reaches local API sink (no external inference)");
      return;
    }
    assert.equal(inference.length, 0, `${prompt} attempted inference: ${inference.join(", ")}`);
    assert.equal(code, 0, stderr || stdout);
    const events = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const hook = events.find((event) => event.subtype === "hook_response" && event.hook_event === "UserPromptExpansion");
    assert.ok(hook, `Missing UserPromptExpansion hook: ${prompt}`);
    assert.equal(JSON.parse(hook.stdout).decision, "block");
    const result = events.find((event) => event.type === "result");
    assert.ok(result, `Missing result: ${prompt}`);
    assert.equal(result.num_turns, 0);
    assert.equal(result.total_cost_usd, 0);
    assert.equal(result.duration_api_ms, 0);
    for (const field of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) {
      assert.equal(result.usage[field], 0, field);
    }
    const init = events.find((event) => event.subtype === "init");
    console.log(`PASS ${prompt}: Claude ${init?.claude_code_version}, 0 model calls, 0 tokens, $0`);
    return result.result;
  }

  await run("Reply with OK", true);
  assert.match(await run("/franko:help"), /Local commands/);
  assert.match(await run("/franko:list"), /Local fixture conversation/);
  assert.match(await run("/franko:details 1"), new RegExp(id));
  assert.match(await run('/franko:search "Local fixture"'), /Local fixture conversation/);
  assert.match(await run('/franko:rename 1 "Fixture renamed"'), /Renamed session/);
  assert.match(await run("/franko:resume 1"), new RegExp(`/resume ${id}`));
  assert.match(await run("/franko:list --limit invalid"), /integer from 1 to 300/);
  assert.match(await run("/franko:search absent-topic"), /No conversations found/);
  assert.match(await run("/franko:resume 1"), /Session not found/);
} finally {
  activeChild?.kill();
  server.closeAllConnections();
  server.close();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
