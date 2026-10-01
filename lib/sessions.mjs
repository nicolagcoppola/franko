import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_FILES = 300;
const MAX_PARSE = 60;
const HEAD_BYTES = 65536;
const TEXT_LIMIT = 120;

export function configDirFor(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

export function projectsDirFor(configDir) {
  return path.join(configDir, "projects");
}

export function slugForDir(cwd) {
  return String(cwd).replace(/[^a-zA-Z0-9]/g, "-");
}

function readHead(file, bytes = HEAD_BYTES) {
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function collapse(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function cleanText(text) {
  const cleaned = collapse(String(text).replace(/<[^>]*>/g, " ").replace(/Caveat:[^\n]*/g, " "));
  return cleaned.length > TEXT_LIMIT ? `${cleaned.slice(0, TEXT_LIMIT - 1)}…` : cleaned;
}

function isNoise(text) {
  const trimmed = String(text).trimStart();
  return (
    trimmed.startsWith("<local-command-") ||
    trimmed.startsWith("<command-") ||
    trimmed.startsWith("<system-reminder>")
  );
}

export function parseTranscriptHead(head) {
  const info = { title: null, summary: null, prompt: null, cwd: null, branch: null };
  for (const line of String(head).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!info.cwd && typeof entry.cwd === "string" && entry.cwd) info.cwd = entry.cwd;
    if (!info.branch && typeof entry.gitBranch === "string" && entry.gitBranch) info.branch = entry.gitBranch;
    if (!info.summary && entry.type === "summary" && typeof entry.summary === "string") {
      const summary = cleanText(entry.summary);
      if (summary) info.summary = summary;
    }
    if (!info.title && (entry.type === "custom-title" || entry.type === "title")) {
      const title = cleanText(entry.customTitle || entry.title || "");
      if (title) info.title = title;
    }
    if (!info.prompt && entry.type === "user" && entry.isMeta !== true && entry.message) {
      const content = entry.message.content;
      let text = null;
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        const part = content.find((item) => item && item.type === "text" && typeof item.text === "string");
        if (part) text = part.text;
      }
      if (text && !isNoise(text)) {
        const prompt = cleanText(text);
        if (prompt) info.prompt = prompt;
      }
    }
  }
  return info;
}

function prettySlug(slug) {
  const tail = String(slug).replace(/^[A-Za-z]--/, "");
  const parts = tail.split("-").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : slug;
}

export function listSessions({ configDir, env = process.env, limit = 10, projectDir, parseLimit = MAX_PARSE } = {}) {
  const base = projectsDirFor(configDir || configDirFor(env));
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }

  const wantedSlug = projectDir ? slugForDir(projectDir) : null;
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (wantedSlug && entry.name !== wantedSlug) continue;
    const dir = path.join(base, entry.name);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!name.endsWith(".jsonl")) continue;
      const file = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      candidates.push({
        projectSlug: entry.name,
        sessionId: name.slice(0, -".jsonl".length),
        file,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      });
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const sessions = [];
  let parsed = 0;

  for (const candidate of candidates) {
    if (parsed >= MAX_FILES || parsed >= parseLimit || sessions.length >= limit) break;
    parsed += 1;
    let info;
    try {
      info = parseTranscriptHead(readHead(candidate.file));
    } catch {
      info = { title: null, summary: null, prompt: null, cwd: null, branch: null };
    }
    const name = info.title || info.summary || info.prompt || null;
    if (!name && !info.cwd) continue;
    sessions.push({
      ...candidate,
      ...info,
      name,
      projectLabel: info.cwd ? path.basename(info.cwd) : prettySlug(candidate.projectSlug),
    });
  }

  return sessions.slice(0, limit);
}
