# Changelog

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
