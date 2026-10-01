---
name: details
description: Show title, project, token consumption, prompts and last reply of a franko session, given its number or name. Use when the user asks for the details of a recent conversation.
allowed-tools: Bash(node:*)
---

# franko:details

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" details $ARGUMENTS
```

Report the output as-is. The number refers to the last list shown by `/franko:list` or `franko list`; details does not change the numbering.

The output includes the exact resume command (`claude --resume <id>`).
