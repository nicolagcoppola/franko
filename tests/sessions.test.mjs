import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listSessions, parseTranscriptHead, slugForDir } from "../lib/sessions.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "franko-sessions-"));
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
  return file;
}

test("parseTranscriptHead skips noise and meta messages", () => {
  const head = [
    JSON.stringify({ type: "mode", mode: "default" }),
    JSON.stringify({
      type: "user",
      isMeta: true,
      message: { content: "<local-command-caveat>Caveat: The messages below were generated" },
    }),
    JSON.stringify({ type: "user", message: { content: "<command-message>claude-spinner:spin</command-message>" } }),
    JSON.stringify({ type: "user", message: { content: "<local-command-stdout>Enabled plan mode</local-command-stdout>" } }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "text", text: "sistemare la validazione" }] },
      cwd: "D:\\Progetti\\rockspinner",
      gitBranch: "main",
    }),
  ].join("\n");
  const info = parseTranscriptHead(head);
  assert.equal(info.prompt, "sistemare la validazione");
  assert.equal(info.cwd, "D:\\Progetti\\rockspinner");
  assert.equal(info.branch, "main");
  assert.equal(info.title, null);
});

test("parseTranscriptHead tolerates malformed lines and reads titles", () => {
  const head = [
    "{not json",
    JSON.stringify({ type: "custom-title", customTitle: "fix validazione catalogo" }),
    JSON.stringify({ type: "summary", summary: "riepilogo della sessione" }),
  ].join("\n");
  const info = parseTranscriptHead(head);
  assert.equal(info.title, "fix validazione catalogo");
  assert.equal(info.summary, "riepilogo della sessione");
});

test("listSessions sorts by recency, applies limit and prefers titles over prompts", () => {
  const configDir = tempDir();
  writeTranscript(
    configDir,
    "D--Progetti-Desktop",
    "11111111-aaaa",
    [{ type: "user", message: { content: "prima richiesta" }, cwd: "D:\\Progetti\\Desktop" }],
    1000,
  );
  writeTranscript(
    configDir,
    "C--Users-Nicola",
    "22222222-bbbb",
    [
      { type: "custom-title", customTitle: "sessione con titolo" },
      { type: "user", message: { content: "altra richiesta" }, cwd: "C:\\Users\\Nicola", gitBranch: "main" },
    ],
    2000,
  );
  const sessions = listSessions({ configDir, limit: 10 });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].sessionId, "22222222-bbbb");
  assert.equal(sessions[0].name, "sessione con titolo");
  assert.equal(sessions[0].projectLabel, "Nicola");
  assert.equal(sessions[0].sizeBytes > 0, true);
  assert.equal(sessions[1].name, "prima richiesta");
  assert.equal(sessions[1].projectLabel, "Desktop");
});

test("listSessions honors limit and projectDir filter", () => {
  const configDir = tempDir();
  writeTranscript(
    configDir,
    "D--Progetti-Desktop",
    "33333333-cccc",
    [{ type: "user", message: { content: "uno" }, cwd: "D:\\Progetti\\Desktop" }],
    3000,
  );
  writeTranscript(
    configDir,
    "D--Progetti-Desktop-rockspinner",
    "44444444-dddd",
    [{ type: "user", message: { content: "due" }, cwd: "D:\\Progetti\\Desktop\\rockspinner" }],
    4000,
  );
  const all = listSessions({ configDir, limit: 1 });
  assert.equal(all.length, 1);
  assert.equal(all[0].sessionId, "44444444-dddd");
  const filtered = listSessions({ configDir, projectDir: "D:\\Progetti\\Desktop" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].sessionId, "33333333-cccc");
  assert.equal(slugForDir("D:\\Progetti\\Desktop"), "D--Progetti-Desktop");
});

test("listSessions skips empty transcripts", () => {
  const configDir = tempDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "55555555-eeee", []);
  assert.deepEqual(listSessions({ configDir }), []);
});

test("listSessions returns an empty array when nothing exists", () => {
  const configDir = tempDir();
  assert.deepEqual(listSessions({ configDir }), []);
});
