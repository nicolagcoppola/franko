---
name: search
description: Search the recent Claude Code conversations by text and show the matches as a Markdown table. Use when the user asks to find a past session by topic, word or project.
allowed-tools: Bash(node:*)
---

# franko:search

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" search $ARGUMENTS --md
```

Rules:

- Report the output as-is, keeping the Markdown table intact and without a code fence.
- The search renumbers the results and saves that numbering, so `/franko:details <number>` and `/franko:resume <number>` refer to the matches just shown.
- If there are no matches, say so plainly; do not fall back to the full list.
