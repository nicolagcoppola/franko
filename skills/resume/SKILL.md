---
name: resume
description: Prepare the native resume command locally. Invoke explicitly; handled before the model.
argument-hint: '<number|"name">'
disable-model-invocation: true
---

# franko:resume

The plugin's `UserPromptExpansion` hook handles this command locally and blocks model execution.
It prints `/resume <id>` and `claude --resume <id>` without starting a nested Claude process or changing the clipboard.

If this text reaches you, the local hook is unavailable. Do not run tools or simulate the result.
Tell the user to enable Franko hooks, reload the plugin, and use a Claude Code version supporting `UserPromptExpansion` (verified on 2.1.286).
Until then, `franko command <number>` in an external terminal avoids model calls. This fallback response itself uses tokens.
