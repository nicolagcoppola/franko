# franko

Franko is the punctual colleague for Claude Code: he greets on every session start, resume and clear with a recap of your recent conversations as a bordered text table, and gives you a local picker with the real conversations of every project, complete with titles, token usage and resume commands.

```text
+----+----------------------------------------------+------------------+---------------+----------+
| #  | Title                                        | Project          | Last activity | Tokens   |
+----+----------------------------------------------+------------------+---------------+----------+
| 1  | Session recap rendering fix                  | franko           | 8m ago        | 12k      |
+----+----------------------------------------------+------------------+---------------+----------+
```

## Features

- **Greeting on every entry point**: `startup`, `resume` and `/clear` through a `SessionStart` hook, with the recent sessions rendered as an aligned, bordered text table
- **Only real conversations**: sessions with local commands, slash commands or empty prompts are hidden
- **Local titles**: a clean title derived from the actual prompts, errors and content, with no AI calls
- **Local picker, zero Claude tokens**: `franko` in a terminal lists, searches, renames and resumes sessions without involving the model
- **Local slash commands**: explicit `/franko:*` commands are intercepted by a command hook before they reach the model. Listing, searching, details, renaming and preparing a resume command use no inference tokens
- **Token usage and cost**: total and breakdown (input, output, cache read, cache written) from the last `cost-state` entry
- **Resume by number**: type `3` in the picker or run `franko 3`
- **Rename to remember**: alias saved in `~/.claude/franko/aliases.json`, plus a best-effort `custom-title` entry for the native picker
- **Cache**: transcripts are re-read only when they change
- **Built-in phrases**: the greeting catalog is internal plugin code, not user configuration
- **Fully offline**: zero npm dependencies, no network access
- **Cross-platform**: Windows, macOS and Linux
- **Local state**: the startup hook only writes under `~/.claude/franko`; an explicit rename also appends a title to the selected transcript, best effort

> Note: Claude Code does not expose sidebar panels to plugins, so the recap appears in the transcript at session start and the interactive picker lives in a terminal.

## Requirements

- Claude Code (CLI) with `UserPromptExpansion` hook support; verified on **2.1.286**. Keep plugin hooks enabled
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

### Local commands in Claude Code

Starting in **0.4.1**, the skills register the command names, but the `UserPromptExpansion` command hook executes them locally and stops expansion before Claude receives the skill prompt. The previous 0.4.0 skills involved the model and consumed tokens.

| Skill | Effect |
| :--- | :--- |
| `/franko:help` | Command and option reference |
| `/franko:list` | Recent conversations as a bordered text table, drawn locally |
| `/franko:details 3` | Details of conversation 3 |
| `/franko:search login` | Search by text, with renumbered results |
| `/franko:rename 3 Login refactoring` | Renames conversation 3 |
| `/franko:resume 3` | Resolves conversation 3 and prepares the resume command |

Claude Code labels the result **`UserPromptExpansion operation blocked by hook`**. This is expected: Franko blocks the model turn after displaying the local result. It is not a failed session lookup. Tables have text borders so they remain readable without a Markdown renderer or an AI response.

`list` and `search` accept `--project`, `--all` and `--limit N` (1–300). Search scans up to 300 recent transcript candidates before applying the result limit. Use quotes for a reference containing spaces, for example `/franko:details "Login refactoring"`.

`/franko:resume` prints `/resume <id>` for you to run inside Claude Code, plus `claude --resume <id>` for an external terminal. It does not launch a nested Claude process or copy to the clipboard.

**Token scope:** the explicit local command causes no model turn. A natural-language request such as "Franko, list my sessions" still goes to Claude and costs tokens. Franko disables automatic model invocation of these skills. Local results may remain in the conversation transcript and can contribute context tokens on a later model turn; this does not promise zero tokens for the rest of the session.

If hooks are disabled, fail to start, time out, or the Claude Code version lacks this event, the local interception cannot be guaranteed. The skill's diagnostic fallback does not execute the operation, but its response uses tokens. Enable hooks and reload the plugin; until then, run `franko list` in an **external terminal**. Shell mode (`!`) inside Claude can trigger an automatic model response and is not the same as an external terminal.

The picker keys: number + Enter resumes, `d N` shows details, `r N name` renames, `/text` filters, `q` quits. Numbers stay stable while the picker is open.

The greetings stay in Italian; the commands, options and interface are in English.

## How it works

- **Real conversations only**: a session is listed when at least one prompt is meaningful. Slash commands, local command output, pasted-only placeholders and empty messages are ignored, even if the session spent tokens.
- **Titles**, in priority order: your alias, a `custom-title` or `summary` entry, then a locally derived title. The derivation strips fillers, resolves quoted errors as `Errore: ...` and truncates at a word boundary.
- **Tokens** come from the last `cost-state` entry: totals plus input, output, cache read and cache written. When data is missing, Franko says "not available" instead of showing zero.
- **Numbers** are stored in a snapshot (`~/.claude/franko/last-list.json`), so `franko 3` keeps matching the list you just saw. `franko search` saves its own numbering.
- **Aliases** live in `~/.claude/franko/aliases.json`. Renaming also appends a `custom-title` entry to the transcript, best effort: if your Claude Code version does not read it, the Franko alias still works.
- **Cache**: parsed transcript heads and tails are cached in `~/.claude/franko/cache.json` and invalidated by file size and mtime.

The transcript format is internal to Claude Code and may change; the reader is tolerant and falls back gracefully. The startup recap uses fixed-width text borders, so it does not depend on Markdown rendering in hook messages. Its title column is limited to 44 characters; use `/franko:details` to read the full title. Markdown output remains available explicitly with `list --md` and `search --md`.

## Development

```bash
npm test
npm run validate
claude plugin validate .
```

To verify actual Claude Code dispatch without spending API credits:

```bash
npm run verify:local
```

This optional check requires an installed Claude Code executable (override its path with `FRANKO_CLAUDE_PATH`). It uses fixture transcripts and an isolated temporary configuration, replaces API credentials with a dummy key, and redirects inference to a loopback HTTP sink. An ordinary-prompt control confirms the sink detects model requests. All six Franko commands, invalid arguments and missing sessions must report zero model turns, zero input/output/cache tokens and zero cost. Claude's startup health requests are separate from inference. This checks CLI dispatch, not interactive terminal styling. Override the temporary parent directory with `FRANKO_VERIFY_TMPDIR` if needed.

## License

MIT
