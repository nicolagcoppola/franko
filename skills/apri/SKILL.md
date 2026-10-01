---
name: apri
description: Prepara il comando per riprendere una sessione elencata da /franko:recenti, dato il suo numero o nome. Usa quando l'utente chiede di aprire o riprendere una sessione recente.
allowed-tools: Bash(node:*)
---

# franko:apri

Risolvi il riferimento e prepara il comando di ripresa:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" command $ARGUMENTS --clip
```

Riporta l'output così com'è.

Regola importante: da dentro la chat non è possibile cambiare sessione; il comando `claude --resume <id>` va incollato nel terminale. Se gli appunti non sono disponibili, mostra il comando da copiare a mano. Nel terminale, senza chat, `franko <numero>` riprende direttamente.
