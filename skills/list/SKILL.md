---
name: list
description: List the most recent real Claude Code conversations with title, project, last activity and tokens, as a Markdown table. Use when the user asks to see recent sessions or where they left off.
allowed-tools: Bash(node:*)
---

# franko:list

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/franko.mjs" list --md
```

Options to pass through when the user asks for them:

- Current project only: `--project`
- Include sessions without real content: `--all`
- Number of rows: `--limit 20`

Rules:

- Report the output as-is. Never invent or summarize sessions.
- Keep the Markdown table intact and do not wrap it in a code fence, so it renders as a table.
- The numbers match the ones used by `/franko:details <number>` and `/franko:resume <number>`.
- To rename a session: `/franko:rename <number> <name>`.
- To resume: `/franko:resume <number>` prepares the command, or `franko <number>` in the terminal resumes directly.
- Zero-token workflow: tell the user to run `franko` in a terminal for the interactive picker.
- If `${CLAUDE_PLUGIN_ROOT}` is not expanded, find the `franko` folder in the plugin cache under `~/.claude/plugins/` and use that path.
