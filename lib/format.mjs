import { interpolate } from "./greetings.mjs";

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const MESSAGE_LIMIT = 9900;
const MIN_WIDTH = 70;
const MARKDOWN_TITLE_LIMIT = 60;

export function formatAge(ms) {
  if (ms < MINUTE) return "now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  const days = Math.floor(ms / DAY);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
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

function truncateWords(text, max) {
  const value = String(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  const head = boundary > max / 2 ? cut.slice(0, boundary) : cut;
  return `${head.trimEnd()}…`;
}

function pad(text, width) {
  const value = String(text);
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function terminalWidth() {
  const width = typeof process.stdout.columns === "number" ? process.stdout.columns : 100;
  return Math.max(MIN_WIDTH, width);
}

function sessionTitle(session) {
  return session.displayName || session.name || session.sessionId.slice(0, 8);
}

function markdownCell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
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
  if (read) parts.push(`cache read ${read}`);
  if (write) parts.push(`cache write ${write}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatMarkdownTable(sessions, { now = Date.now(), titleLimit = MARKDOWN_TITLE_LIMIT } = {}) {
  const lines = [];
  lines.push("| # | Title | Project | Last activity | Tokens |");
  lines.push("| --- | --- | --- | --- | --- |");
  sessions.forEach((session, index) => {
    const number = session.number || index + 1;
    const title = markdownCell(truncateWords(sessionTitle(session), titleLimit));
    const project = markdownCell(session.projectLabel || "project");
    const age = formatAge(now - session.mtimeMs);
    const tokens = formatTokens(session.tokens) || "-";
    lines.push(`| ${number} | ${title} | ${project} | ${age} | ${tokens} |`);
  });
  return lines.join("\n");
}

export function recapLines(sessions, now = Date.now()) {
  return formatMarkdownTable(sessions, { now }).split("\n");
}

// Hook notices can be plain text. Draw borders without involving the model.
export function formatBorderedTable(sessions, { now = Date.now() } = {}) {
  const widths = [Math.max(2, String(sessions.length).length), 44, 16, 13, 8];
  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const row = (cells) => `| ${cells.map((cell, index) => {
    const text = String(cell).replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
    return pad(truncateWords(text, widths[index]), widths[index]);
  }).join(" | ")} |`;
  const lines = [border, row(["#", "Title", "Project", "Last activity", "Tokens"]), border];
  sessions.forEach((session, index) => {
    lines.push(row([
      session.number || index + 1,
      sessionTitle(session),
      session.projectLabel || "project",
      formatAge(now - session.mtimeMs),
      formatTokens(session.tokens) || "-",
    ]));
    lines.push(border);
  });
  if (!sessions.length) lines.push("No conversations found.");
  return lines.join("\n");
}

export function buildRecapMessage({ sessions, greeting, recapIntro, emptyPhrase, now = Date.now() }) {
  const lines = [greeting, ""];
  if (sessions.length === 0) {
    lines.push(emptyPhrase);
  } else {
    const projects = new Set(sessions.map((session) => session.projectSlug)).size;
    lines.push(interpolate(recapIntro, { n: sessions.length, p: projects }));
    lines.push("");
    lines.push(formatMarkdownTable(sessions, { now }));
    lines.push("");
    lines.push("Open /franko:list to browse and resume a session.");
  }
  const message = lines.join("\n");
  return message.length > MESSAGE_LIMIT ? `${message.slice(0, MESSAGE_LIMIT - 1)}…` : message;
}

export function formatTable(sessions, { now = Date.now(), width = terminalWidth(), footer = null } = {}) {
  const lines = [];
  const projects = new Set(sessions.map((session) => session.projectSlug)).size;
  lines.push("FRANKO · Recent sessions");
  lines.push(`${sessions.length} conversations · ${projects} projects`);
  lines.push("");

  if (sessions.length === 0) {
    lines.push("No conversations found.");
    if (footer) {
      lines.push("");
      lines.push(footer);
    }
    return lines.join("\n");
  }

  const numberWidth = Math.max(2, String(sessions.length).length);
  const projectWidth = Math.min(
    18,
    Math.max(7, ...sessions.map((session) => (session.projectLabel || "project").length)),
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
    pad("Title", titleWidth),
    pad("Project", projectWidth),
    pad("Last activity", ageWidth),
  ];
  if (showTokens) header.push(pad("Tokens", tokenWidth));
  lines.push(`  ${header.join("  ").trimEnd()}`);

  sessions.forEach((session, index) => {
    const number = session.number || index + 1;
    const title = truncate(sessionTitle(session), titleWidth);
    const row = [
      pad(String(number), numberWidth),
      pad(title, titleWidth),
      pad(truncate(session.projectLabel || "project", projectWidth), projectWidth),
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
  const number = session.number ? `${session.number} · ` : "";
  lines.push(`${number}${sessionTitle(session)}`);
  lines.push(`Project: ${session.cwd || session.projectSlug}`);
  lines.push(`Session: ${session.sessionId}`);
  lines.push(
    `Activity: ${formatAge(now - session.mtimeMs)}${session.sizeBytes ? ` · ${Math.round(session.sizeBytes / 1024)} KB` : ""}`,
  );

  const breakdown = formatBreakdown(session);
  const tokenLine = formatTokens(session.tokens);
  if (tokenLine || breakdown || session.costUSD) {
    const consumption = [tokenLine ? `${tokenLine} tokens` : "not available", formatCost(session.costUSD)]
      .filter(Boolean)
      .join(" · ");
    lines.push(`Consumption: ${consumption}`);
    if (breakdown) lines.push(`Breakdown: ${breakdown}`);
  } else {
    lines.push("Consumption: not available");
  }
  if (session.models && session.models.length > 0) lines.push(`Models: ${session.models.join(", ")}`);
  if (session.alias && session.name && session.alias !== session.name) lines.push(`Automatic title: ${session.name}`);
  if (session.branch) lines.push(`Branch: ${session.branch}`);

  if (session.prompts && session.prompts.length > 0) {
    lines.push("");
    lines.push("Main prompts:");
    for (const prompt of session.prompts.slice(0, 5)) lines.push(`- ${truncate(prompt, 110)}`);
  }
  if (session.lastReply) {
    lines.push("");
    lines.push(`Last reply: ${truncate(session.lastReply, 160)}`);
  }

  lines.push("");
  lines.push(`Resume: claude --resume ${session.sessionId}`);
  return lines.join("\n");
}
