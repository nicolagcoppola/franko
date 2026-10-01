import fs from "node:fs";
import path from "node:path";
import { configDirFor, historyPathFor, projectsDirFor, slugForDir } from "./paths.mjs";
import { pruneCache, readCache, writeCache } from "./cache.mjs";
import { deriveTitle, isMeaningfulPrompt } from "./titles.mjs";

const MAX_FILES = 300;
const MAX_PARSE = 60;
const HEAD_BYTES = 65536;
const TAIL_BYTES = 32768;
const PROMPT_LIMIT = 200;
const MAX_PROMPTS = 5;
const CACHE_VERSION = 3;

export { configDirFor, historyPathFor, projectsDirFor, slugForDir };

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
  return cleaned.length > 120 ? `${cleaned.slice(0, 119)}…` : cleaned;
}

function cleanPrompt(text) {
  const cleaned = collapse(String(text).replace(/<[^>]*>/g, " ").replace(/Caveat:[^\n]*/g, " "));
  return cleaned.length > PROMPT_LIMIT ? `${cleaned.slice(0, PROMPT_LIMIT - 1)}…` : cleaned;
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

function messageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const part = content.find((item) => item && item.type === "text" && typeof item.text === "string");
    if (part) return part.text;
  }
  return null;
}

export function parseTranscriptHead(head) {
  const info = { title: null, summary: null, prompts: [], prompt: null, cwd: null, branch: null };
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
    if (entry.type === "user" && entry.isMeta !== true && entry.message && info.prompts.length < MAX_PROMPTS) {
      const text = messageText(entry.message.content);
      if (text && !isNoise(text)) {
        const prompt = cleanPrompt(text);
        if (prompt) info.prompts.push(prompt);
      }
    }
  });
  info.prompt = info.prompts[0] || null;
  return info;
}

export function parseTranscriptTail(tail) {
  const info = {
    title: null,
    lastPrompt: null,
    lastReply: null,
    tokens: null,
    costUSD: null,
    breakdown: null,
    models: [],
  };
  parseLines(tail, (entry) => {
    if (entry.type === "custom-title" || entry.type === "title") {
      const title = cleanText(entry.customTitle || entry.title || "");
      if (title) info.title = title;
    } else if (entry.type === "last-prompt" && typeof entry.lastPrompt === "string") {
      const prompt = cleanPrompt(entry.lastPrompt);
      if (prompt && !isNoise(prompt) && isMeaningfulPrompt(prompt)) info.lastPrompt = prompt;
    } else if (entry.type === "assistant" && entry.message) {
      const text = messageText(entry.message.content);
      if (text) {
        const reply = cleanText(text);
        if (reply) info.lastReply = reply;
      }
    } else if (entry.type === "cost-state" && entry.modelUsage && typeof entry.modelUsage === "object") {
      const breakdown = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      const models = [];
      for (const [model, usage] of Object.entries(entry.modelUsage)) {
        if (!usage || typeof usage !== "object") continue;
        if (!models.includes(model)) models.push(model);
        breakdown.inputTokens += numberOrZero(usage.inputTokens);
        breakdown.outputTokens += numberOrZero(usage.outputTokens);
        breakdown.cacheReadTokens += numberOrZero(usage.cacheReadInputTokens);
        breakdown.cacheWriteTokens += numberOrZero(usage.cacheCreationInputTokens);
      }
      info.breakdown = breakdown;
      info.tokens =
        breakdown.inputTokens + breakdown.outputTokens + breakdown.cacheReadTokens + breakdown.cacheWriteTokens;
      info.costUSD = typeof entry.totalCostUSD === "number" ? entry.totalCostUSD : null;
      info.models = models;
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
    if (!sessionId || !display) return;
    if (!map.has(sessionId)) {
      const cleaned = cleanPrompt(display);
      if (cleaned && isMeaningfulPrompt(cleaned)) map.set(sessionId, cleaned);
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
  useCache = true,
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
  const cache = useCache ? readCache(root, env) : { entries: {} };
  const liveFiles = new Set();
  let cacheDirty = false;

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
    liveFiles.add(candidate.file);

    let head = { title: null, summary: null, prompts: [], prompt: null, cwd: null, branch: null };
    let tail = { title: null, lastPrompt: null, lastReply: null, tokens: null, costUSD: null, breakdown: null, models: [] };

    const cached = cache.entries[candidate.file];
    if (useCache && cached && cached.version === CACHE_VERSION && cached.mtimeMs === candidate.mtimeMs && cached.size === candidate.size) {
      head = cached.head;
      tail = cached.tail;
    } else {
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
      if (useCache) {
        cache.entries[candidate.file] = {
          version: CACHE_VERSION,
          mtimeMs: candidate.mtimeMs,
          size: candidate.size,
          head,
          tail,
        };
        cacheDirty = true;
      }
    }

    const historyPrompt = history.get(candidate.sessionId) || null;
    const autoName =
      head.title ||
      tail.title ||
      head.summary ||
      deriveTitle([...(head.prompts || []), tail.lastPrompt, historyPrompt]) ||
      null;
    const hasContent = Boolean(autoName);
    if (!hasContent && !includeEmpty) continue;

    const name = autoName || "(solo comandi locali)";
    sessions.push({
      ...candidate,
      title: head.title || tail.title,
      summary: head.summary,
      prompts: head.prompts || [],
      prompt: head.prompt,
      lastPrompt: tail.lastPrompt,
      lastReply: tail.lastReply,
      cwd: head.cwd,
      branch: head.branch,
      tokens: tail.tokens,
      costUSD: tail.costUSD,
      breakdown: tail.breakdown,
      models: tail.models || [],
      name,
      hasContent,
      projectLabel: head.cwd ? path.basename(head.cwd) : prettySlug(candidate.projectSlug),
    });
  }

  if (useCache) {
    pruneCache(cache, liveFiles);
    if (cacheDirty || Object.keys(cache.entries).length !== Object.keys(liveFiles).length) writeCache(cache, root, env);
  }

  return sessions.slice(0, limit);
}
