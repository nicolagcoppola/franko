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

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncate(text, max) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function recapLines(sessions, now = Date.now()) {
  return sessions.map((session, index) => {
    const label = session.projectLabel || "progetto";
    const name = session.name ? `"${truncate(session.name, 70)}"` : session.sessionId.slice(0, 8);
    return `${index + 1}. ${label} — ${name} — ${formatAge(now - session.mtimeMs)}`;
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
    lines.push(`${index + 1}. ${session.name || session.sessionId.slice(0, 8)}`);
    lines.push(`   Progetto: ${session.cwd || session.projectSlug}`);
    lines.push(`   Attività: ${formatAge(now - session.mtimeMs)} — ${formatBytes(session.sizeBytes)}`);
    lines.push(`   Riprendi: claude --resume ${session.sessionId}`);
    lines.push("");
  });
  lines.push("In alternativa: /resume e cerca la sessione per titolo o progetto.");
  return lines.join("\n");
}
