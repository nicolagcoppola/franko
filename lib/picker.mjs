export function parsePickerCommand(line, count) {
  const text = String(line ?? "").trim();
  if (!text) return { type: "list" };
  if (text === "q" || text === "quit" || text === "exit" || text === "esci") return { type: "quit" };
  if (/^\d+$/.test(text)) {
    const index = Number(text) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "numero fuori intervallo" };
    return { type: "open", index };
  }
  const detail = text.match(/^d(?:ettagli)?\s+(\d+)$/i);
  if (detail) {
    const index = Number(detail[1]) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "numero fuori intervallo" };
    return { type: "detail", index };
  }
  const rename = text.match(/^r(?:inomina)?\s+(\d+)\s+(.+)$/i);
  if (rename) {
    const index = Number(rename[1]) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "numero fuori intervallo" };
    return { type: "rename", index, name: rename[2].trim() };
  }
  if (text.startsWith("/")) return { type: "search", query: text.slice(1).trim() };
  return { type: "invalid", reason: "comando non riconosciuto" };
}

export function filterSessions(sessions, query) {
  if (!query) return sessions;
  const needle = query.toLowerCase();
  return sessions.filter((session) =>
    [session.displayName, session.name, session.projectLabel, session.cwd]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}
