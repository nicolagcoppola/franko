export const GREETING_STEPS = ["startup", "resume", "clear", "recap", "list", "empty", "error"];

export const GREETINGS = {
  startup: [
    "Franko qui. Buongiorno, tutto in ordine. Faccio subito il punto della situazione.",
    "Ciao, Franko. Ambiente pronto, nessuna anomalia. Ecco il punto della situazione.",
    "Buongiorno! Franko in servizio. Riepilogo delle ultime attività in arrivo.",
    "Ciao! Franko ai comandi. Prima di partire, il punto della situazione.",
  ],
  resume: [
    "Bentornato. Franko qui: riprendo il filo e ti aggiorno.",
    "Ciao di nuovo. Franko: ecco dove ci eravamo fermati.",
    "Sessione ripresa. Franko presente: quadro aggiornato subito.",
  ],
  clear: [
    "Pulizia fatta. Franko: pagina bianca, ma l'archivio delle sessioni resta qui.",
    "Contesto azzerato. Franko: ripartiamo ordinati, il punto lo faccio comunque.",
  ],
  recap: [
    "Punto della situazione: {n} sessioni recenti su {p} progetti.",
    "Ecco il quadro delle ultime sessioni, in ordine di attività:",
  ],
  list: [
    "Elenco completo. Copia il comando della sessione che ti interessa.",
    "Ultime sessioni disponibili. Per riprenderne una: claude --resume <nome>.",
  ],
  empty: [
    "Nessuna sessione trovata: archivio pulito. Si parte da zero.",
  ],
  error: [
    "Franko non riesce a leggere l'archivio sessioni. Saluto fatto; dettagli con /franko:list.",
  ],
};

const MAX_PHRASE = 140;
const PLACEHOLDER = /\{(\w+)\}/g;
const ALLOWED_PLACEHOLDERS = new Set(["n", "p"]);

export function pickGreeting(step, random = Math.random) {
  const pool = GREETINGS[step] || GREETINGS.startup;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

export function interpolate(template, values = {}) {
  return String(template).replace(PLACEHOLDER, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function validateGreetings(catalog = GREETINGS) {
  const errors = [];
  const counts = {};
  const seen = new Map();

  for (const step of GREETING_STEPS) {
    const pool = catalog[step];
    if (!Array.isArray(pool) || pool.length === 0) {
      errors.push(`step "${step}": missing or empty list`);
      continue;
    }
    counts[step] = pool.length;
    for (const phrase of pool) {
      if (typeof phrase !== "string" || !phrase.trim()) {
        errors.push(`step "${step}": empty phrase`);
        continue;
      }
      if (phrase !== phrase.trim()) {
        errors.push(`step "${step}": phrase has surrounding whitespace: "${phrase}"`);
      }
      if (phrase.length > MAX_PHRASE) {
        errors.push(`step "${step}": phrase longer than ${MAX_PHRASE} chars: "${phrase.slice(0, 40)}..."`);
      }
      for (const [, key] of phrase.matchAll(PLACEHOLDER)) {
        if (!ALLOWED_PLACEHOLDERS.has(key)) {
          errors.push(`step "${step}": unknown placeholder {${key}} in "${phrase}"`);
        }
      }
      const normalized = phrase.toLowerCase();
      if (seen.has(normalized)) {
        errors.push(`duplicate phrase in "${step}" and "${seen.get(normalized)}": "${phrase}"`);
      } else {
        seen.set(normalized, step);
      }
    }
  }

  for (const step of Object.keys(catalog)) {
    if (!GREETING_STEPS.includes(step)) {
      errors.push(`unknown step "${step}"`);
    }
  }

  return { ok: errors.length === 0, errors, counts };
}
