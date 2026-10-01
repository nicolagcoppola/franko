# franko

Franko is the punctual colleague for Claude Code: he greets on every session start, resume and clear with a recap of your recent conversations as a Markdown table, and gives you a local picker with the real conversations of every project, complete with titles, token usage and resume commands.

```text
| # | Title                                        | Project     | Last activity | Tokens |
| --- | --- | --- | --- | --- |
| 1 | Configurazione workspace API Anthropic       | Nicola      | 5d ago        | 344k   |
| 2 | Idee per plugin Claude Code e OpenCode       | rockspinner | 6d ago        | 278k   |
| 3 | Prove del nuovo spinner                      | Nicola      | 1w ago        | 317k   |
```

## Features

- **Greeting on every entry point**: `startup`, `resume` and `/clear` through a `SessionStart` hook, with the recent sessions rendered as a Markdown table
- **Only real conversations**: sessions with local commands, slash commands or empty prompts are hidden
- **Local titles**: a clean title derived from the actual prompts, errors and content, with no AI calls
- **Local picker, zero Claude tokens**: `franko` in a terminal lists, searches, renames and resumes sessions without involving the model
- **Token usage and cost**: total and breakdown (input, output, cache read, cache written) from the last `cost-state` entry
- **Resume by number**: type `3` in the picker or run `franko 3`
- **Rename to remember**: alias saved in `~/.claude/franko/aliases.json`, plus a best-effort `custom-title` entry for the native picker
- **Cache**: transcripts are re-read only when they change
- **Built-in phrases**: the greeting catalog is internal plugin code, not user configuration
- **Fully offline**: zero npm dependencies, no network access
- **Cross-platform**: Windows, macOS and Linux
- **Safe**: the hook never writes outside `~/.claude/franko` and exits 0 even on failure

> Note: Claude Code does not expose sidebar panels to plugins, so the recap appears in the transcript at session start and the interactive picker lives in a terminal.

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

### Terminal command

```bash
npm run shim        # writes franko / franko.cmd into ~/.local/bin
npm run shim:remove # removes it
```

### Manual (development)

```bash
git clone git@github.com:nicolagcoppola/franko.git
claude --plugin-dir /path/to/franko
```

## Usage

| Command | Effect |
| :--- | :--- |
| `franko` | Local picker: list, search, detail, rename and resume without Claude tokens |
| `franko 3` | Resumes conversation 3 directly |
| `franko list` | Non-interactive list (`--project`, `--all`, `--limit N`, `--md`, `--json`) |
| `franko search login` | Searches titles, projects and paths, then renumbers the results |
| `franko details 3` | Full detail: id, path, token breakdown, prompts, last reply |
| `franko resume 3` | Resumes conversation 3 (same as the bare number) |
| `franko rename 3 "Login refactoring"` | Renames conversation 3 |
| `franko command 3 --clip` | Copies `claude --resume <id>` to the clipboard |

Aliases are kept for compatibility: `detail`, `open` and `rinomina`.

### Skills in Claude Code

| Skill | Effect |
| :--- | :--- |
| `/franko:help` | Command and option reference |
| `/franko:list` | Recent conversations as a Markdown table |
| `/franko:details 3` | Details of conversation 3 |
| `/franko:search login` | Search by text, with renumbered results |
| `/franko:rename 3 Login refactoring` | Renames conversation 3 |
| `/franko:resume 3` | Resolves conversation 3 and prepares the resume command |

The picker keys: number + Enter resumes, `d N` shows details, `r N name` renames, `/text` filters, `q` quits. Numbers stay stable while the picker is open.

The greetings stay in Italian; the commands, options and interface are in English.

## How it works

- **Real conversations only**: a session is listed when at least one prompt is meaningful. Slash commands, local command output, pasted-only placeholders and empty messages are ignored, even if the session spent tokens.
- **Titles**, in priority order: your alias, a `custom-title` or `summary` entry, then a locally derived title. The derivation strips fillers, resolves quoted errors as `Errore: ...` and truncates at a word boundary.
- **Tokens** come from the last `cost-state` entry: totals plus input, output, cache read and cache written. When data is missing, Franko says "not available" instead of showing zero.
- **Numbers** are stored in a snapshot (`~/.claude/franko/last-list.json`), so `franko 3` keeps matching the list you just saw. `franko search` saves its own numbering.
- **Aliases** live in `~/.claude/franko/aliases.json`. Renaming also appends a `custom-title` entry to the transcript, best effort: if your Claude Code version does not read it, the Franko alias still works.
- **Cache**: parsed transcript heads and tails are cached in `~/.claude/franko/cache.json` and invalidated by file size and mtime.

The transcript format is internal to Claude Code and may change; the reader is tolerant and falls back gracefully. The Markdown recap depends on how Claude Code renders hook messages: if a version shows it as plain text, the terminal picker remains the reference interface.

## Development

```bash
npm test
npm run validate
claude plugin validate .
```

## License

MIT
