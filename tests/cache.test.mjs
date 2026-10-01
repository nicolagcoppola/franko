import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cachePathFor, pruneCache, readCache, writeCache } from "../lib/cache.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "franko-cache-"));
}

test("cache round-trip", () => {
  const configDir = tempDir();
  assert.deepEqual(readCache(configDir), { entries: {} });
  const cache = { entries: { "a.jsonl": { mtimeMs: 1, size: 2 } } };
  writeCache(cache, configDir);
  assert.deepEqual(readCache(configDir), cache);
  assert.equal(fs.existsSync(cachePathFor(configDir)), true);
});

test("pruneCache removes dead files and caps size", () => {
  const entries = {};
  for (let index = 0; index < 5; index += 1) entries[`f${index}`] = { mtimeMs: index };
  const cache = pruneCache({ entries }, new Set(["f3", "f4"]), 1);
  assert.deepEqual(Object.keys(cache.entries), ["f4"]);
});
