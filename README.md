# franko

Franko is the punctual colleague for Claude Code: he greets on every session start, resume and clear, and immediately recaps the latest sessions across all projects so you can jump back into what you were working on.

```text
Franko qui. Buongiorno, tutto in ordine. Faccio subito il punto della situazione.

Punto della situazione: 10 sessioni recenti su 3 progetti.
1. Desktop — "fix validazione catalogo" — 2h fa
2. rockspinner — "serie di plugin per opencode" — 1g fa
3. Desktop — "recap sessioni franko" — 2g fa

Apri /franko:recenti per riprendere una sessione.
```

## Features

- **Greeting on every entry point**: `startup`, `resume` and `/clear` through a `SessionStart` hook
- **Recap across all projects**: the latest 10 sessions from `~/.claude/projects`, newest first
- **Ready resume commands**: `/franko:recenti` prints `claude --resume <session-id>` for every session
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
| `/franko:recenti` | Latest 10 sessions of every project with resume commands |
| `/franko:recenti` + `--project` option | Only sessions of the current project |
| `/franko:recenti` + `--limit N` option | Show N sessions |
| `/franko:recenti` + `--json` option | Machine-readable output |

The same commands work without the plugin:

```bash
node scripts/franko.mjs list
node scripts/franko.mjs list --project
node scripts/franko.mjs list --json
```

To resume a session, run `claude --resume <session-id>` in a terminal, or open `/resume` and search by title or project.

## How it works

- `hooks/hooks.json` registers a `SessionStart` hook for `startup`, `resume` and `clear`.
- `scripts/franko.mjs hook` reads the hook payload from stdin, scans `~/.claude/projects/*/*.jsonl` (honoring `CLAUDE_CONFIG_DIR`) and returns a `systemMessage` with the greeting plus the recap.
- `lib/sessions.mjs` reads only the head of each transcript (64 KB) and picks a display name in this order: custom title, summary, first real user prompt. Command wrappers and local-command noise are skipped.
- `lib/greetings.mjs` holds the fixed phrase catalog used for every step.

The transcript format is internal to Claude Code and may change; the reader is tolerant and falls back to file name and timestamp metadata.

## Development

```bash
npm test
npm run validate
claude plugin validate .
```

## License

MIT
