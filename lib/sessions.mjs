import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_FILES = 300;
const MAX_PARSE = 60;
const HEAD_BYTES = 65536;
const TAIL_BYTES = 32768;
const TEXT_LIMIT = 120;

export function configDirFor(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

export function projectsDirFor(configDir) {
  return path.join(configDir, "projects");
}

export function historyPathFor(configDir) {
  return path.join(configDir, "history.jsonl");
}

export function slugForDir(cwd) {
  return String(cwd).replace(/[^a-zA-Z0-9]/g, "-");
}

function readChunk(file, position, bytes) {
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, position);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function readHead(file, bytes = HEAD_BYTES) {
  return readChunk(file, 0, bytes);
}

function readTail(file, bytes = TAIL_BYTES) {
  const size = fs.statSync(file).size;
  return readChunk(file, Math.max(0, size - bytes), bytes);
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

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseLines(text, onEntry) {
  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    onEntry(entry);
  }
}

export function parseTranscriptHead(head) {
  const info = { title: null, summary: null, prompt: null, cwd: null, branch: null };
  parseLines(head, (entry) => {
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
  });
  return info;
}

export function parseTranscriptTail(tail) {
  const info = { title: null, lastPrompt: null, tokens: null, costUSD: null };
  parseLines(tail, (entry) => {
    if (entry.type === "custom-title" || entry.type === "title") {
      const title = cleanText(entry.customTitle || entry.title || "");
      if (title) info.title = title;
    } else if (entry.type === "last-prompt" && typeof entry.lastPrompt === "string") {
      const prompt = cleanText(entry.lastPrompt);
      if (prompt && !isNoise(prompt)) info.lastPrompt = prompt;
    } else if (entry.type === "cost-state" && entry.modelUsage && typeof entry.modelUsage === "object") {
      let tokens = 0;
      for (const usage of Object.values(entry.modelUsage)) {
        if (!usage || typeof usage !== "object") continue;
        tokens +=
          numberOrZero(usage.inputTokens) +
          numberOrZero(usage.outputTokens) +
          numberOrZero(usage.cacheReadInputTokens) +
          numberOrZero(usage.cacheCreationInputTokens);
      }
      info.tokens = tokens;
      info.costUSD = typeof entry.totalCostUSD === "number" ? entry.totalCostUSD : null;
    }
  });
  return info;
}

export function loadPromptHistory(configDir) {
  const map = new Map();
  let text;
  try {
    text = fs.readFileSync(historyPathFor(configDir), "utf8");
  } catch {
    return map;
  }
  parseLines(text, (entry) => {
    const sessionId = entry.sessionId;
    const display = typeof entry.display === "string" ? entry.display.trim() : "";
    if (!sessionId || !display || display.startsWith("/")) return;
    if (!map.has(sessionId)) {
      const cleaned = cleanText(display);
      if (cleaned) map.set(sessionId, cleaned);
    }
  });
  return map;
}

function prettySlug(slug) {
  const tail = String(slug).replace(/^[A-Za-z]--/, "");
  const parts = tail.split("-").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : slug;
}

export function listSessions({
  configDir,
  env = process.env,
  limit = 10,
  projectDir,
  parseLimit = MAX_PARSE,
  includeEmpty = false,
} = {}) {
  const root = configDir || configDirFor(env);
  const base = projectsDirFor(root);
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }

  const history = loadPromptHistory(root);
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

    let head = { title: null, summary: null, prompt: null, cwd: null, branch: null };
    let tail = { title: null, lastPrompt: null, tokens: null, costUSD: null };
    try {
      head = parseTranscriptHead(readHead(candidate.file));
    } catch {
      /* keep defaults */
    }
    try {
      tail = parseTranscriptTail(readTail(candidate.file));
    } catch {
      /* keep defaults */
    }

    const tokens = tail.tokens;
    const autoName =
      head.title ||
      tail.title ||
      head.summary ||
      history.get(candidate.sessionId) ||
      head.prompt ||
      tail.lastPrompt ||
      null;
    const hasContent = Boolean(autoName);
    if (!hasContent && !(tokens > 0) && !includeEmpty) continue;

    const name = autoName || (tokens > 0 ? "(sessione senza prompt)" : "(solo comandi locali)");
    sessions.push({
      ...candidate,
      title: head.title || tail.title,
      summary: head.summary,
      prompt: head.prompt,
      lastPrompt: tail.lastPrompt,
      cwd: head.cwd,
      branch: head.branch,
      tokens,
      costUSD: tail.costUSD,
      name,
      hasContent,
      projectLabel: head.cwd ? path.basename(head.cwd) : prettySlug(candidate.projectSlug),
    });
  }

  return sessions.slice(0, limit);
}
