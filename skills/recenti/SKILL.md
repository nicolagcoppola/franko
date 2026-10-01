---
name: recenti
description: Elenca le ultime sessioni di Claude Code su tutti i progetti, con nome, token consumati e comando per riprenderle. Usa quando l'utente chiede di vedere o riprendere sessioni recenti.
allowed-tools: Bash(node:*)
---

# franko:recenti

Esegui il CLI del plugin e riporta l'output così com'è, senza inventare o riassumere le sessioni:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" list
```

Opzioni:

- Solo progetto corrente: `--project`
- Includi anche sessioni senza contenuto reale: `--all`
- Numero di sessioni: `--limit 20`
- Output JSON: `--json`

Regole:

- Mostra solo ciò che il comando restituisce.
- I numeri della lista sono gli stessi usati da `/franko:apri <numero>` e da `franko <numero>` nel terminale.
- Per cambiare nome a una sessione: `/franko:rinnomina <numero> <nome>`.
- Per riprendere: `/franko:apri <numero>` prepara il comando, oppure `claude --resume <id>` nel terminale.
- Se `${CLAUDE_PLUGIN_ROOT}` non viene espanso, cerca la cartella `franko` nella cache dei plugin sotto `~/.claude/plugins/` e usa lo stesso percorso.
