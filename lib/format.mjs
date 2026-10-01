import { interpolate } from "./greetings.mjs";

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const MESSAGE_LIMIT = 9900;

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
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function recapLines(sessions, now = Date.now()) {
  return sessions.map((session, index) => {
    const label = session.projectLabel || "progetto";
    const name = session.name ? `"${truncate(session.name, 70)}"` : session.sessionId.slice(0, 8);
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

export function formatList(sessions, header, now = Date.now()) {
  const lines = [header, ""];
  if (sessions.length === 0) {
    lines.push("Nessuna sessione trovata.");
    return lines.join("\n");
  }
  sessions.forEach((session, index) => {
    lines.push(`${index + 1}. ${session.displayName || session.name || session.sessionId.slice(0, 8)}`);
    lines.push(`   Progetto: ${session.cwd || session.projectSlug}`);
    const parts = [`Attività: ${formatAge(now - session.mtimeMs)}`];
    const tokens = formatTokens(session.tokens);
    if (tokens) parts.push(`${tokens} token`);
    const cost = formatCost(session.costUSD);
    if (cost) parts.push(cost);
    lines.push(`   ${parts.join(" — ")}`);
    if (session.alias && session.name && session.alias !== session.name) {
      lines.push(`   Automatico: ${session.name}`);
    }
    lines.push(`   Riprendi: claude --resume ${session.sessionId}`);
    lines.push("");
  });
  lines.push("In alternativa: /resume e cerca la sessione per titolo o progetto.");
  return lines.join("\n");
}
