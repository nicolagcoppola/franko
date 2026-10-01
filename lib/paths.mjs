import os from "node:os";
import path from "node:path";

export function configDirFor(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

export function projectsDirFor(configDir) {
  return path.join(configDir, "projects");
}

export function historyPathFor(configDir) {
  return path.join(configDir, "history.jsonl");
}

export function stateDirFor(configDir, env = process.env) {
  return path.join(configDir || configDirFor(env), "franko");
}

export function slugForDir(cwd) {
  return String(cwd).replace(/[^a-zA-Z0-9]/g, "-");
}
