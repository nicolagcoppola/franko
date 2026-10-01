---
name: resume
description: Resolve a franko session number or name and prepare the claude --resume command to reopen it. Use when the user asks to open or resume a recent conversation.
allowed-tools: Bash(node:*)
---

# franko:resume

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" command $ARGUMENTS --clip
```

Report the output as-is.

Important rule: a plugin cannot switch the active conversation from inside the chat. The `claude --resume <id>` command must be pasted in the terminal. If the clipboard is unavailable, show the command for manual copy. In the terminal, `franko <number>` resumes directly without chat.
