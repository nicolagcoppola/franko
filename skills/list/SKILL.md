---
name: list
description: Local session table with title, project, activity and tokens. Invoke explicitly; handled before the model.
argument-hint: "[--project] [--all] [--limit N]"
disable-model-invocation: true
---

# franko:list

The plugin's `UserPromptExpansion` hook handles this command locally and blocks model execution.

If this text reaches you, the local hook is unavailable. Do not run tools or simulate the result.
Tell the user to enable Franko hooks, reload the plugin, and use a Claude Code version supporting `UserPromptExpansion` (verified on 2.1.286).
Until then, `franko list` in an external terminal avoids model calls. This fallback response itself uses tokens.
