import test from "node:test";
import assert from "node:assert/strict";
import { GREETINGS, GREETING_STEPS, interpolate, pickGreeting, validateGreetings } from "../lib/greetings.mjs";

test("catalog is valid", () => {
  const result = validateGreetings();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.counts.startup, 4);
  assert.equal(result.counts.resume, 3);
  assert.equal(result.counts.clear, 2);
  assert.equal(result.counts.recap, 2);
  assert.equal(result.counts.list, 2);
  assert.equal(result.counts.empty, 1);
  assert.equal(result.counts.error, 1);
});

test("every step has at least one phrase", () => {
  for (const step of GREETING_STEPS) {
    assert.ok(Array.isArray(GREETINGS[step]) && GREETINGS[step].length > 0, `step ${step}`);
  }
});

test("pickGreeting stays inside the pool and falls back to startup", () => {
  assert.equal(pickGreeting("startup", () => 0), GREETINGS.startup[0]);
  assert.equal(pickGreeting("unknown", () => 0), GREETINGS.startup[0]);
  assert.equal(pickGreeting("clear", () => 0.99), GREETINGS.clear[GREETINGS.clear.length - 1]);
});

test("interpolate replaces known placeholders and leaves the rest", () => {
  assert.equal(interpolate("Punto: {n} su {p}", { n: 10, p: 3 }), "Punto: 10 su 3");
  assert.equal(interpolate("niente {x}", {}), "niente {x}");
});

test("validator rejects duplicates", () => {
  const catalog = { ...GREETINGS, startup: [...GREETINGS.startup, GREETINGS.resume[0]] };
  const result = validateGreetings(catalog);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate")));
});

test("validator rejects unknown placeholders and long phrases", () => {
  const catalog = { ...GREETINGS, error: ["Ciao {x}", "x".repeat(141)] };
  const result = validateGreetings(catalog);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unknown placeholder")));
  assert.ok(result.errors.some((error) => error.includes("longer than")));
});
