---
name: recenti
description: Elenca le ultime sessioni di Claude Code su tutti i progetti con il comando per riprenderle. Usa quando l'utente chiede di vedere o riprendere sessioni recenti.
allowed-tools: Bash(node:*)
---

# franko:recenti

Esegui il CLI del plugin e riporta l'output così com'è, senza inventare o riassumere le sessioni:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" list
```

Opzioni:

- Solo progetto corrente: `--project`
- Tutti i progetti (predefinito): `--all`
- Numero di sessioni: `--limit 20`
- Output JSON: `--json`

Regole:

- Mostra solo ciò che il comando restituisce.
- Per riprendere una sessione, l'utente esegue `claude --resume <session-id>` nel terminale, oppure apre `/resume` e cerca per titolo o progetto.
- Se `${CLAUDE_PLUGIN_ROOT}` non viene espanso, cerca la cartella `franko` nella cache dei plugin sotto `~/.claude/plugins/` e usa lo stesso percorso.
