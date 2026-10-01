import test from "node:test";
import assert from "node:assert/strict";
import { formatBreakdown, formatCost, formatDetail, formatTable, formatTokens } from "../lib/format.mjs";

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
  assert.match(text, /Sessione: 8fe77e93/);
  assert.match(text, /cache letta 320k/);
  assert.match(text, /claude --resume 8fe77e93/);
});

test("missing consumption is explicit", () => {
  const text = formatDetail(session({ tokens: null, breakdown: null, costUSD: null }));
  assert.match(text, /Consumo: non disponibile/);
});

test("token and cost formatting", () => {
  assert.equal(formatTokens(999), "999");
  assert.equal(formatTokens(1500), "2k");
  assert.equal(formatTokens(1500000), "1.5M");
  assert.equal(formatTokens(0), null);
  assert.equal(formatCost(0.22), "$0.22");
  assert.equal(formatCost(0), null);
  assert.equal(formatCost(0.002), "<$0.01");
  assert.equal(formatBreakdown(session()), "input 2k · output 6k · cache letta 320k · cache scritta 16k");
});
