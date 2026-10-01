import fs from "node:fs";
import path from "node:path";
import { stateDirFor } from "./paths.mjs";

const MAX_ENTRIES = 500;

export function cachePathFor(configDir, env = process.env) {
  return path.join(stateDirFor(configDir, env), "cache.json");
}

export function readCache(configDir, env = process.env) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePathFor(configDir, env), "utf8"));
    if (parsed && typeof parsed === "object" && parsed.entries && typeof parsed.entries === "object") {
      return parsed;
    }
  } catch {
    /* missing or unreadable: start fresh */
  }
  return { entries: {} };
}

export function writeCache(cache, configDir, env = process.env) {
  try {
    const file = cachePathFor(configDir, env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, file);
  } catch {
    /* best effort: cache is optional */
  }
}

export function pruneCache(cache, liveFiles, max = MAX_ENTRIES) {
  const entries = cache.entries || {};
  for (const key of Object.keys(entries)) {
    if (!liveFiles.has(key)) delete entries[key];
  }
  const remaining = Object.keys(entries);
  if (remaining.length > max) {
    remaining.sort((a, b) => (entries[a].mtimeMs || 0) - (entries[b].mtimeMs || 0));
    for (const key of remaining.slice(0, remaining.length - max)) delete entries[key];
  }
  cache.entries = entries;
  return cache;
}
