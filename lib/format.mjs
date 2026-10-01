import { interpolate } from "./greetings.mjs";

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const MESSAGE_LIMIT = 9900;
const MIN_WIDTH = 70;

export function formatAge(ms) {
  if (ms < MINUTE) return "adesso";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m fa`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h fa`;
  const days = Math.floor(ms / DAY);
  if (days < 7) return `${days}g fa`;
  if (days < 30) return `${Math.floor(days / 7)} sett fa`;
  return `${Math.floor(days / 30)} mesi fa`;
}

export function formatTokens(tokens) {
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens <= 0) return null;
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}

export function formatCost(costUSD) {
  if (typeof costUSD !== "number" || !Number.isFinite(costUSD) || costUSD <= 0) return null;
  if (costUSD < 0.005) return "<$0.01";
  return `$${costUSD.toFixed(2)}`;
}

export function truncate(text, max) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;
}

function pad(text, width) {
  const value = String(text);
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function terminalWidth() {
  const width = typeof process.stdout.columns === "number" ? process.stdout.columns : 100;
  return Math.max(MIN_WIDTH, width);
}

export function formatBreakdown(session) {
  const breakdown = session.breakdown;
  if (!breakdown) return null;
  const parts = [];
  const input = formatTokens(breakdown.inputTokens);
  const output = formatTokens(breakdown.outputTokens);
  const read = formatTokens(breakdown.cacheReadTokens);
  const write = formatTokens(breakdown.cacheWriteTokens);
  if (input) parts.push(`input ${input}`);
  if (output) parts.push(`output ${output}`);
  if (read) parts.push(`cache letta ${read}`);
  if (write) parts.push(`cache scritta ${write}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function recapLines(sessions, now = Date.now()) {
  return sessions.map((session, index) => {
    const label = session.projectLabel || "progetto";
    const title = session.displayName || session.name;
    const name = title ? `"${truncate(title, 70)}"` : session.sessionId.slice(0, 8);
    const tokens = formatTokens(session.tokens);
    const suffix = tokens ? ` — ${tokens} tok` : "";
    return `${index + 1}. ${label} — ${name} — ${formatAge(now - session.mtimeMs)}${suffix}`;
  });
}

export function buildRecapMessage({ sessions, greeting, recapIntro, emptyPhrase, now = Date.now() }) {
  const lines = [greeting, ""];
  if (sessions.length === 0) {
    lines.push(emptyPhrase);
  } else {
    const projects = new Set(sessions.map((session) => session.projectSlug)).size;
    lines.push(interpolate(recapIntro, { n: sessions.length, p: projects }));
    lines.push(...recapLines(sessions, now));
    lines.push("");
    lines.push("Apri /franko:recenti per riprendere una sessione.");
  }
  const message = lines.join("\n");
  return message.length > MESSAGE_LIMIT ? `${message.slice(0, MESSAGE_LIMIT - 1)}…` : message;
}

export function formatTable(sessions, { now = Date.now(), width = terminalWidth(), footer = null } = {}) {
  const lines = [];
  const projects = new Set(sessions.map((session) => session.projectSlug)).size;
  lines.push("FRANKO · Sessioni recenti");
  lines.push(`${sessions.length} conversazioni · ${projects} progetti`);
  lines.push("");

  if (sessions.length === 0) {
    lines.push("Nessuna conversazione trovata.");
    if (footer) {
      lines.push("");
      lines.push(footer);
    }
    return lines.join("\n");
  }

  const numberWidth = Math.max(2, String(sessions.length).length);
  const projectWidth = Math.min(
    18,
    Math.max(7, ...sessions.map((session) => (session.projectLabel || "progetto").length)),
  );
  const ageWidth = 13;
  const showTokens = width >= 100;
  const tokenWidth = 8;
  const gaps = showTokens ? 8 : 6;
  const titleWidth = Math.max(
    24,
    width - numberWidth - projectWidth - ageWidth - gaps - (showTokens ? tokenWidth : 0) - 2,
  );

  const header = [
    pad("#", numberWidth),
    pad("Titolo", titleWidth),
    pad("Progetto", projectWidth),
    pad("Ultima attività", ageWidth),
  ];
  if (showTokens) header.push(pad("Token", tokenWidth));
  lines.push(`  ${header.join("  ").trimEnd()}`);

  sessions.forEach((session, index) => {
    const number = session.number || index + 1;
    const title = truncate(session.displayName || session.name || session.sessionId.slice(0, 8), titleWidth);
    const row = [
      pad(String(number), numberWidth),
      pad(title, titleWidth),
      pad(truncate(session.projectLabel || "progetto", projectWidth), projectWidth),
      pad(formatAge(now - session.mtimeMs), ageWidth),
    ];
    if (showTokens) row.push(pad(formatTokens(session.tokens) || "-", tokenWidth));
    lines.push(`  ${row.join("  ").trimEnd()}`);
  });

  if (footer) {
    lines.push("");
    lines.push(footer);
  }
  return lines.join("\n");
}

export function formatDetail(session, now = Date.now()) {
  const lines = [];
  const title = session.displayName || session.name || session.sessionId.slice(0, 8);
  const number = session.number ? `${session.number} · ` : "";
  lines.push(`${number}${title}`);
  lines.push(`Progetto: ${session.cwd || session.projectSlug}`);
  lines.push(`Sessione: ${session.sessionId}`);
  lines.push(`Attività: ${formatAge(now - session.mtimeMs)}${session.sizeBytes ? ` · ${Math.round(session.sizeBytes / 1024)} KB` : ""}`);

  const breakdown = formatBreakdown(session);
  const tokenLine = formatTokens(session.tokens);
  if (tokenLine || breakdown || session.costUSD) {
    const consumption = [tokenLine ? `${tokenLine} token` : "non disponibile", formatCost(session.costUSD)]
      .filter(Boolean)
      .join(" · ");
    lines.push(`Consumo: ${consumption}`);
    if (breakdown) lines.push(`Dettaglio: ${breakdown}`);
  } else {
    lines.push("Consumo: non disponibile");
  }
  if (session.models && session.models.length > 0) lines.push(`Modelli: ${session.models.join(", ")}`);
  if (session.alias && session.name && session.alias !== session.name) lines.push(`Titolo automatico: ${session.name}`);
  if (session.branch) lines.push(`Branch: ${session.branch}`);

  if (session.prompts && session.prompts.length > 0) {
    lines.push("");
    lines.push("Prompt principali:");
    for (const prompt of session.prompts.slice(0, 5)) lines.push(`- ${truncate(prompt, 110)}`);
  }
  if (session.lastReply) {
    lines.push("");
    lines.push(`Ultima risposta: ${truncate(session.lastReply, 160)}`);
  }

  lines.push("");
  lines.push(`Riprendi: claude --resume ${session.sessionId}`);
  return lines.join("\n");
}
