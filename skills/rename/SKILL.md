---
name: rename
description: Rename a franko session so it is easy to remember, given its number or name. Use when the user asks to give a name to a recent conversation.
allowed-tools: Bash(node:*)
---

# franko:rename

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" rename $ARGUMENTS
```

Report the output. The name is saved in the franko aliases and, when possible, appended to the transcript for the native Claude Code picker.
