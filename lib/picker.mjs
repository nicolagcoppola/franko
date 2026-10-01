export function parsePickerCommand(line, count) {
  const text = String(line ?? "").trim();
  if (!text) return { type: "list" };
  if (/^(q|quit|exit|esci)$/i.test(text)) return { type: "quit" };
  if (/^\d+$/.test(text)) {
    const index = Number(text) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "number out of range" };
    return { type: "open", index };
  }
  const detail = text.match(/^(?:d|details?|dettagli)\s+(\d+)$/i);
  if (detail) {
    const index = Number(detail[1]) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "number out of range" };
    return { type: "detail", index };
  }
  const rename = text.match(/^(?:r|rename|rinomina)\s+(\d+)\s+(.+)$/i);
  if (rename) {
    const index = Number(rename[1]) - 1;
    if (index < 0 || index >= count) return { type: "invalid", reason: "number out of range" };
    return { type: "rename", index, name: rename[2].trim() };
  }
  if (text.startsWith("/")) return { type: "search", query: text.slice(1).trim() };
  return { type: "invalid", reason: "unknown command" };
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
