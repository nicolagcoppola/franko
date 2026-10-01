import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listSessions, parseTranscriptHead, parseTranscriptTail, slugForDir } from "../lib/sessions.mjs";

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

test("parseTranscriptTail reads tokens, cost, breakdown and last prompt", () => {
  const tail = [
    JSON.stringify({ type: "last-prompt", lastPrompt: "ultimo prompt utile" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "risposta finale" }] } }),
    JSON.stringify({
      type: "cost-state",
      sessionId: "x",
      totalCostUSD: 0.12,
      modelUsage: {
        "claude-opus": {
          inputTokens: 100,
          outputTokens: 50,
          thinkingTokens: 10,
          cacheReadInputTokens: 1000,
          cacheCreationInputTokens: 200,
        },
        "claude-haiku": { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      },
    }),
  ].join("\n");
  const info = parseTranscriptTail(tail);
  assert.equal(info.lastPrompt, "ultimo prompt utile");
  assert.equal(info.lastReply, "risposta finale");
  assert.equal(info.tokens, 1365);
  assert.equal(info.costUSD, 0.12);
  assert.deepEqual(info.breakdown, {
    inputTokens: 110,
    outputTokens: 55,
    cacheReadTokens: 1000,
    cacheWriteTokens: 200,
  });
  assert.deepEqual(info.models.sort(), ["claude-haiku", "claude-opus"]);
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
  assert.equal(sessions[1].name, "Prima richiesta");
  assert.equal(sessions[1].projectLabel, "Desktop");
});

test("listSessions derives a clean title from prompts", () => {
  const configDir = tempDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "cccc3333-0000", [
    { type: "user", message: { content: "<command-name>/plugin</command-name>" } },
    { type: "user", message: { content: "vorrei capire come funziona il parser delle sessioni" } },
  ]);
  const sessions = listSessions({ configDir });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].name, "Capire come funziona il parser delle sessioni");
});

test("listSessions names sessions from history and hides command-only ones", () => {
  const configDir = tempDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "aaaa1111-0000", [
    { type: "user", isMeta: true, message: { content: "<local-command-caveat>Caveat: ..." } },
    { type: "user", message: { content: "<command-name>/plugin</command-name>" } },
  ], 1000);
  writeTranscript(configDir, "C--Users-Nicola", "bbbb2222-0000", [
    { type: "user", message: { content: "<command-name>/clear</command-name>" } },
  ], 2000);
  fs.writeFileSync(
    path.join(configDir, "history.jsonl"),
    [
      JSON.stringify({ display: "/plugin install franko", sessionId: "aaaa1111-0000" }),
      JSON.stringify({ display: "sistemare il parser sessioni", sessionId: "aaaa1111-0000" }),
      JSON.stringify({ display: "/clear", sessionId: "bbbb2222-0000" }),
    ].join("\n"),
  );

  const sessions = listSessions({ configDir });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, "aaaa1111-0000");
  assert.equal(sessions[0].name, "Sistemare il parser sessioni");
  assert.equal(sessions[0].hasContent, true);

  const withEmpty = listSessions({ configDir, includeEmpty: true });
  assert.equal(withEmpty.length, 2);
  const empty = withEmpty.find((session) => session.sessionId === "bbbb2222-0000");
  assert.equal(empty.name, "(solo comandi locali)");
  assert.equal(empty.hasContent, false);
});

test("listSessions excludes command-only sessions even when tokens were spent", () => {
  const configDir = tempDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "eeee5555-0000", [
    { type: "user", message: { content: "/rockspinner:spin grunge" } },
    {
      type: "cost-state",
      sessionId: "eeee5555-0000",
      totalCostUSD: 0.12,
      modelUsage: { m: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } },
    },
  ]);
  assert.deepEqual(listSessions({ configDir }), []);
});

test("listSessions sums the token breakdown and writes a cache", () => {
  const configDir = tempDir();
  writeTranscript(configDir, "D--Progetti-Desktop", "dddd4444-0000", [
    { type: "user", message: { content: "sistemare la cache dei transcript" } },
    {
      type: "cost-state",
      sessionId: "dddd4444-0000",
      totalCostUSD: 0.5,
      modelUsage: { m: { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 3000, cacheCreationInputTokens: 400 } },
    },
  ]);
  const sessions = listSessions({ configDir });
  assert.equal(sessions[0].tokens, 3430);
  assert.deepEqual(sessions[0].breakdown, {
    inputTokens: 10,
    outputTokens: 20,
    cacheReadTokens: 3000,
    cacheWriteTokens: 400,
  });
  assert.equal(fs.existsSync(path.join(configDir, "franko", "cache.json")), true);
  const again = listSessions({ configDir });
  assert.equal(again[0].tokens, 3430);
  assert.equal(again[0].name, "Sistemare la cache dei transcript");
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
