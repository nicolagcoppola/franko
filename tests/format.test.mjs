import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecapMessage,
  formatBreakdown,
  formatCost,
  formatDetail,
  formatMarkdownTable,
  formatTable,
  formatTokens,
} from "../lib/format.mjs";

function session(overrides = {}) {
  return {
    sessionId: "8fe77e93-8197-4c4f-8be4-abc7b2ff4c31",
    name: "Configurazione workspace API Anthropic",
    displayName: null,
    projectLabel: "Desktop",
    projectSlug: "D--Progetti-Desktop",
    cwd: "D:\\Progetti\\Desktop",
    mtimeMs: Date.now() - 3600000,
    tokens: 344000,
    costUSD: 0.22,
    breakdown: { inputTokens: 2400, outputTokens: 5700, cacheReadTokens: 320000, cacheWriteTokens: 16000 },
    models: ["claude-opus-5-5[1m]"],
    prompts: ["sistemare il recap", "aggiungere i token"],
    lastReply: "fatto",
    ...overrides,
  };
}

test("table shows titles without session ids", () => {
  const text = formatTable([session()], { width: 120 });
  assert.match(text, /FRANKO/);
  assert.match(text, /Configurazione workspace API Anthropic/);
  assert.doesNotMatch(text, /8fe77e93/);
  assert.match(text, /344k/);
});

test("table uses the compact layout on narrow terminals", () => {
  const text = formatTable([session()], { width: 80 });
  const headerLine = text.split("\n")[3];
  assert.doesNotMatch(headerLine, /Token/);
});

test("detail includes id, breakdown and resume command", () => {
  const text = formatDetail(session());
  assert.match(text, /Session: 8fe77e93/);
  assert.match(text, /cache read 320k/);
  assert.match(text, /claude --resume 8fe77e93/);
});

test("missing consumption is explicit", () => {
  const text = formatDetail(session({ tokens: null, breakdown: null, costUSD: null }));
  assert.match(text, /Consumption: not available/);
});

test("token and cost formatting", () => {
  assert.equal(formatTokens(999), "999");
  assert.equal(formatTokens(1500), "2k");
  assert.equal(formatTokens(1500000), "1.5M");
  assert.equal(formatTokens(0), null);
  assert.equal(formatCost(0.22), "$0.22");
  assert.equal(formatCost(0), null);
  assert.equal(formatCost(0.002), "<$0.01");
  assert.equal(formatBreakdown(session()), "input 2k · output 6k · cache read 320k · cache write 16k");
});

test("markdown table has the session columns", () => {
  const item = session();
  const text = formatMarkdownTable([item], { now: item.mtimeMs + 3600000 });
  const lines = text.split("\n");
  assert.equal(lines[0], "| # | Title | Project | Last activity | Tokens |");
  assert.equal(lines[1], "| --- | --- | --- | --- | --- |");
  assert.equal(lines[2], "| 1 | Configurazione workspace API Anthropic | Desktop | 1h ago | 344k |");
});

test("markdown table escapes pipes, truncates long titles and marks missing tokens", () => {
  const item = session({
    name: `titolo con | pipe ${"x".repeat(80)}`,
    tokens: null,
    mtimeMs: Date.now() - 10 * 86400000,
  });
  const text = formatMarkdownTable([item], { now: Date.now() });
  const row = text.split("\n")[2];
  assert.match(row, /\\\|/);
  assert.match(row, /…/);
  assert.match(row, /\| 1w ago \| - \|$/);
});

test("recap message embeds an aligned bordered table for plain-text hooks", () => {
  const item = session();
  const message = buildRecapMessage({
    sessions: [item],
    greeting: "Ciao.",
    recapIntro: "Punto: {n} su {p}.",
    emptyPhrase: "Vuoto.",
    now: item.mtimeMs + 3600000,
  });
  assert.match(message, /^Ciao\./);
  assert.match(message, /Punto: 1 su 1\./);
  assert.match(message, /^\| #\s+\| Title\s+\| Project\s+\| Last activity\s+\| Tokens\s+\|$/m);
  assert.match(message, /^\+(?:-+\+){5}$/m);
  assert.doesNotMatch(message, /\| --- \|/);
  const table = message.split("\n").filter((line) => /^[+|]/.test(line));
  assert.equal(table.length, 5);
  assert.equal(new Set(table.map((line) => line.length)).size, 1);
  assert.match(message, /\/franko:list/);
});

test("default ten-session recap fits the message limit with long titles", () => {
  const items = Array.from({ length: 10 }, (_, index) => session({
    name: `Session ${index + 1}: ${"long path and details ".repeat(15)}`,
    projectLabel: "project-with-a-long-name",
  }));
  const message = buildRecapMessage({
    sessions: items,
    greeting: "Ciao.",
    recapIntro: "Punto: {n} su {p}.",
    emptyPhrase: "Vuoto.",
    now: items[0].mtimeMs + 3600000,
  });
  const table = message.split("\n").filter((line) => /^[+|]/.test(line));
  const rows = table.filter((line) => /^\| \d/.test(line));
  assert.equal(rows.length, 10);
  assert.equal(table.length, 23);
  assert.equal(new Set(table.map((line) => line.length)).size, 1);
  for (const row of rows) {
    const title = row.split("|")[2];
    assert.equal(title.length, 46); // 44-character column plus one space on each side.
    assert.match(title, /…/);
  }
  assert.ok(message.length < 9900);
  assert.ok(message.endsWith("Open /franko:list to browse and resume a session."));
});
