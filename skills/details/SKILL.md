---
name: details
description: Local session details. Invoke explicitly; handled before the model.
argument-hint: '<number|"name">'
disable-model-invocation: true
---

# franko:details

The plugin's `UserPromptExpansion` hook handles this command locally and blocks model execution.

If this text reaches you, the local hook is unavailable. Do not run tools or simulate the result.
Tell the user to enable Franko hooks, reload the plugin, and use a Claude Code version supporting `UserPromptExpansion` (verified on 2.1.286).
Until then, `franko details <number>` in an external terminal avoids model calls. This fallback response itself uses tokens.
