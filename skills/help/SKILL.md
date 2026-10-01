---
name: help
description: Show the franko commands and options with examples. Use when the user asks what franko can do or how to use it.
allowed-tools: Bash(node:*)
---

# franko:help

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" help
```

Report the output as-is. Do not invent commands that are not listed.

Point the user to the terminal picker (`franko`) for a zero-token workflow, and to the other `/franko:*` skills for chat-driven operations.
