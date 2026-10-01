const PASTED = /\[Pasted text[^\]]*\]/gi;
const FILLERS = /^(devo|dovrei|vorrei|voglio|mi serve|mi servirebbe|ho bisogno di|come posso|come faccio a|potresti|potrebbe|puoi|per favore)\s+/i;
const EMPTY_LEAD = /^(devo fare questo|ecco|questo|cosi|ok|bene)[:.,]?\s*$/i;

export function stripPasted(text) {
  return String(text)
    .replace(PASTED, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMeaningfulPrompt(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return false;
  if (raw.startsWith("<")) return false;
  if (raw.startsWith("/") || raw.startsWith("!")) return false;
  const stripped = stripPasted(raw);
  if (!stripped) return false;
  if (EMPTY_LEAD.test(stripped)) return false;
  const letters = (stripped.match(/\p{L}/gu) || []).length;
  if (letters < 3) return false;
  if (stripped.length < 3 && !/error/i.test(stripped)) return false;
  return true;
}

function trimAtWord(text, max) {
  const value = String(text).trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 30 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

function finishTitle(text) {
  const value = String(text)
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return null;
  const first = value[0];
  return /[a-z]/.test(first) ? first.toUpperCase() + value.slice(1) : value;
}

export function deriveTitle(texts) {
  for (const candidate of texts) {
    if (!candidate) continue;
    let text = stripPasted(String(candidate));
    if (!isMeaningfulPrompt(text)) continue;
    text = text.replace(FILLERS, "");
    const errorMatch = text.match(/error:\s*(.{4,90})/i);
    if (errorMatch) {
      return finishTitle(`Errore: ${trimAtWord(errorMatch[1], 60)}`);
    }
    const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
    return finishTitle(trimAtWord(sentence, 70));
  }
  return null;
}
