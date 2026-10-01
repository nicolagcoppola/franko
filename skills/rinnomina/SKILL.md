---
name: rinnomina
description: Rinomina una sessione elencata da /franko:recenti per ricordarla, dato il numero o il nome. Usa quando l'utente chiede di dare un nome a una sessione.
allowed-tools: Bash(node:*)
---

# franko:rinnomina

Esegui:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" rinomina $ARGUMENTS
```

Riporta l'output. Il nome viene salvato negli alias di Franko e, quando possibile, aggiunto al transcript per il picker nativo di Claude Code.
