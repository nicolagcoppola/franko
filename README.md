# franko

Franko is the punctual colleague for Claude Code: he greets on every session start, resume and clear, and immediately recaps the latest sessions across all projects with names, token usage and ready resume commands.

```text
Franko qui. Buongiorno, tutto in ordine. Faccio subito il punto della situazione.

Punto della situazione: 8 sessioni recenti su 3 progetti.
1. Desktop — "fix validazione catalogo" — 2h fa — 344k tok
2. rockspinner — "serie di plugin per opencode" — 1g fa — 278k tok
3. Desktop — "recap sessioni franko" — 2g fa — 43k tok

Apri /franko:recenti per riprendere una sessione.
```

## Features

- **Greeting on every entry point**: `startup`, `resume` and `/clear` through a `SessionStart` hook
- **Recap across all projects**: the latest 10 sessions from `~/.claude/projects`, newest first
- **Real names**: custom title, summary, prompt history or transcript prompt, in that order; sessions with only local commands are hidden by default
- **Token usage and cost**: read from the last `cost-state` entry of each transcript
- **Resume by number**: `/franko:apri 3` copies the resume command; `franko 3` in a terminal resumes directly
- **Rename to remember**: `/franko:rinnomina 3 nome` stores an alias and, when possible, appends a custom title for the native picker
- **Built-in phrases**: the greeting catalog is internal plugin code, not user configuration
- **Tolerant transcript reader**: sessions are read best-effort; older formats or malformed lines never break the hook
- **Fully offline**: zero npm dependencies, no network access
- **Cross-platform**: Windows, macOS and Linux
- **Safe**: the hook never writes to `~/.claude` and exits 0 even on failure

> Note: Claude Code does not expose sidebar panels to plugins, so the recap appears in the transcript at session start. For an interactive session list, use the built-in `/resume` picker or the `/franko:recenti` command.

## Requirements

- Claude Code (CLI)
- Node.js 18 or later

## Install

### Claude Code plugin marketplace (recommended)

```text
/plugin marketplace add nicolagcoppola/franko
/plugin install franko@franko
```

Franko starts working in new sessions. To load it in the current one, restart Claude Code or run `/reload-plugins`.

### Manual (development)

```bash
git clone git@github.com:nicolagcoppola/franko.git
claude --plugin-dir /path/to/franko
```

## Usage

| Command | Effect |
| :--- | :--- |
| `/franko:recenti` | Latest 10 sessions of every project, with tokens, cost and resume commands |
| `/franko:apri 3` | Resolves session 3 and copies `claude --resume <id>`: paste it in a terminal |
| `/franko:rinnomina 3 nome` | Renames session 3 with an alias |
| `franko 3` | Terminal: resumes session 3 directly (requires the shim, see below) |
| `franko list --project` | Only sessions of the current project |
| `franko list --all` | Include sessions with no real content |
| `franko list --json` | Machine-readable output |

The same commands work without the plugin:

```bash
node scripts/franko.mjs list
node scripts/franko.mjs command 3 --clip
node scripts/franko.mjs rinomina 3 "nome che ricordo"
node scripts/franko.mjs open 3
```

A plugin cannot switch sessions from inside Claude Code, so `/franko:apri` prepares the command and copies it; the actual resume happens in a terminal.

### Install the `franko` terminal command

```bash
npm run shim        # writes franko / franko.cmd into ~/.local/bin
npm run shim:remove # removes it
```

## How names and tokens are resolved

- **Name priority**: `custom-title` entry, `summary` entry, first non-command prompt from `~/.claude/history.jsonl`, first real prompt in the transcript head, `lastPrompt` in the transcript tail. Sessions with no real content are hidden unless `--all` is used.
- **Tokens**: sum of `inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens` across models in the last `cost-state` entry; cost from `totalCostUSD`.
- **Numbers**: `list` stores a snapshot in `~/.claude/franko/last-list.json`, so `franko 3` and `/franko:apri 3` keep referring to the same list you just saw.
- **Aliases**: `~/.claude/franko/aliases.json`. Renaming also appends a `custom-title` entry to the transcript, best effort: if your Claude Code version does not read it, the Franko alias still works.

The transcript format is internal to Claude Code and may change; the reader is tolerant and falls back to file name and timestamp metadata.

## Development

```bash
npm test
npm run validate
claude plugin validate .
```

## License

MIT
