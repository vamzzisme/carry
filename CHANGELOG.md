# Changelog

## Unreleased
- New tagline in the npm, MCP Registry, plugin and Claude Desktop extension descriptions: "AirDrop for AI chats and projects".

## 0.4.4 (2026-11-07)
- Tab completion on every platform: `carry setup` turns it on for zsh, bash (Linux, Git Bash, macOS) and PowerShell
  (Windows). On PowerShell it skips profiles where scripts are blocked and says how to allow them.

## 0.4.3 (2026-11-07)
- Pairing codes are about 4x shorter (`carry2.<inbox>.<secret>`, about 63 characters). Your name and the pair id now
  travel inside the encrypted inbox. Old `carry1.` codes still work.
- `carry setup` turns on Tab completion in zsh by itself (one line in `~/.zshrc` that sources `~/.carry/completion.zsh`).
- `carry open <chat> --to claude_app` opens the chat as a real Claude Code session in the Claude desktop app's Code tab
  (through its `claude://resume` link); `--to codex_app` does the same for the Codex app (`codex://threads`).
  The MCP tool `carry_open` takes both as `continue_in`.
- Opening into Claude Code or Codex works without their command-line tools installed: carry uses the `codex` inside
  ChatGPT for Mac when it's there, otherwise runs them through `npx`.
- An unknown command prints help on stderr and exits 1, so `carry <typo> >> file` no longer writes the help text into the file.

## 0.4.2 (2026-11-07)
- Tab completion for zsh: `carry completion zsh >> ~/.zshrc`. Completes commands, flags, chat names, pack names and `--to` targets.
- `carry share` and `carry open` with no name show the newest few, numbered; type a number (Enter picks the first).
- Web mode: open your own shares by name (`carry open <name>`), no Drive link needed. Your own Drive links open directly
  instead of asking for a browser download.
- Fix: `carry share` failed with "File not found" after the `carry` folder or a shared file was deleted in Drive. carry now
  makes a new one.

## 0.4.1 (2026-11-07)
- Claude Desktop extension: download `carry.mcpb` from the latest GitHub release and double-click to install.
- Claude Code plugin: `claude plugin marketplace add vamzzisme/carry`, then `claude plugin install carry@carry`.
- Listed in the official MCP Registry as `io.github.vamzzisme/carry`.
- MCP tools now have titles and read-only / write hints, so apps can ask before carry shares anything.

## 0.4.0 (2026-11-07)
- **Friends, inbox and return.** Pair once (`carry friend add`), then `carry share <chat> --to <friend>` (also projects).
  Friends pick from `carry inbox` and `carry open <number>`; no emails or links. Everything a friend can read is encrypted
  (AES-256-GCM) with a key that only lives in the pairing code.
- `carry return <chat>` / `carry return --project <name>` sends borrowed work back. The owner sees it as UPDATED and continues
  from the latest; if both sides kept going, the friend's version opens next to theirs and nothing is overwritten. Projects
  bring back new chats and memory notes (a note changed on both sides is kept as `<note>.from-<friend>.md`).
- `--auto-return` + `carry sync` (or `carry install-hook` for Claude Code's SessionEnd) sends borrowed work back on its own.
- MCP: `carry_add_friend`, `carry_inbox`, `carry_return`; share tools take `to`.
- Fix: npm 12 (which blocks install scripts) left carry without txcript; carry now fetches it on first use.
- `carry projects`: your repos with their chats, Claude memory notes and **related** chats (started elsewhere, e.g. the
  parent folder, that worked on the repo's files). `carry projects <name>` lists them to pick from.
- `carry share --project <name>` by name, with `--add`, `--skip` and `--related` to choose chats. MCP: `carry_list_projects`.
- `carry doctor`: shows carry, Node and txcript versions and how sharing is set up (fetches txcript if missing).

## 0.3.0 (2026-11-07)
- Published on npm as `@heyvamz/carry`: `npm install -g @heyvamz/carry`.
- `carry update` and a once-a-day "new version" notice (opt out with `CARRY_NO_UPDATE_CHECK=1`).
- Project sharing: `carry share --project` bundles a repo's recent chats, Claude Code memory notes, CLAUDE.md / AGENTS.md
  and a handoff. `carry open <project> --to claude_code|codex --dir <clone>` puts the memory where the agent reads it.
- MCP server (`carry mcp`) with 8 tools for Claude Desktop, Codex and Cursor.
- `carry note` (share a summary from a chat app) and `carry open --to here`.
- `carry install-skill` adds `/carry` to Claude Code, Codex and `~/.agents`.
- `npm install` downloads a checksum-verified txcript for your OS.
- Works on macOS, Windows and Linux; every push runs an end-to-end test on all three.
- Fix: `KEY=sk-...` was counted as two redactions.

## 0.2.0 (2026-11-06)
- Google Drive web mode: browser sign-in, upload, share by email or link, open from a Drive link.
- Single-file `.carry` packs.

## 0.1.0 (2026-11-06)
- First version: chats by name, share to a synced folder, secret redaction, handoff summary, open in Claude Code.
