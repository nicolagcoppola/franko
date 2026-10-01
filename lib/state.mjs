import fs from "node:fs";
import path from "node:path";
import { configDirFor } from "./sessions.mjs";

export function stateDirFor(configDir, env = process.env) {
  return path.join(configDir || configDirFor(env), "franko");
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function readAliases(configDir, env = process.env) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(stateDirFor(configDir, env), "aliases.json"), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeAliases(aliases, configDir, env = process.env) {
  writeJsonAtomic(path.join(stateDirFor(configDir, env), "aliases.json"), aliases);
}

export function readSnapshot(configDir, env = process.env) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(stateDirFor(configDir, env), "last-list.json"), "utf8"));
    return parsed && Array.isArray(parsed.sessions) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(sessions, configDir, env = process.env) {
  writeJsonAtomic(path.join(stateDirFor(configDir, env), "last-list.json"), {
    savedAt: Date.now(),
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      displayName: session.displayName || session.name,
    })),
  });
}

export function applyAliases(sessions, aliases) {
  return sessions.map((session) => {
    const alias = aliases[session.sessionId];
    const trimmed = typeof alias === "string" ? alias.trim() : "";
    return {
      ...session,
      alias: trimmed || null,
      displayName: trimmed || session.name,
    };
  });
}
