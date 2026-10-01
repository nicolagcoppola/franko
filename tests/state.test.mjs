import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyAliases, readAliases, readSnapshot, writeAliases, writeSnapshot } from "../lib/state.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "franko-state-"));
}

test("aliases round-trip", () => {
  const configDir = tempDir();
  assert.deepEqual(readAliases(configDir), {});
  writeAliases({ "sid-1": "nome uno" }, configDir);
  assert.deepEqual(readAliases(configDir), { "sid-1": "nome uno" });
  assert.equal(fs.existsSync(path.join(configDir, "franko", "aliases.json")), true);
});

test("applyAliases sets displayName and keeps the automatic name", () => {
  const sessions = [
    { sessionId: "a", name: "auto a" },
    { sessionId: "b", name: "auto b" },
  ];
  const result = applyAliases(sessions, { a: "alias" });
  assert.equal(result[0].displayName, "alias");
  assert.equal(result[0].name, "auto a");
  assert.equal(result[1].displayName, "auto b");
  assert.equal(result[1].alias, null);
});

test("snapshot round-trip", () => {
  const configDir = tempDir();
  assert.equal(readSnapshot(configDir), null);
  writeSnapshot([{ sessionId: "a", displayName: "uno" }], configDir);
  const snapshot = readSnapshot(configDir);
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.sessions[0].sessionId, "a");
  assert.equal(snapshot.sessions[0].displayName, "uno");
  assert.equal(typeof snapshot.savedAt, "number");
});
