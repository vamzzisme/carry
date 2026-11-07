# carry

Out of tokens? Keep coding. carry moves a Claude Code or Codex session, with its full history, to another account,
another tool or a friend's laptop. Or hand over the whole project (recent chats, Claude's memory notes, CLAUDE.md /
AGENTS.md and a handoff) so the next agent knows what was tried and why. Packs go into **your** Google Drive
(or Dropbox/iCloud). Nothing is hosted by us.

Why not paste a summary? A summary keeps what the AI chose to remember. carry keeps every message, command, error and
dead end, and the next agent resumes it as its own session.

npm: [@thevxmzstudio/carry](https://www.npmjs.com/package/@thevxmzstudio/carry) · Site: https://carry-site-beta.vercel.app · v0.3.0 · built by [@heyvxmz](https://x.com/heyvxmz)

Built on [txcript](https://github.com/skillsynchq/txcript). carry adds names, Codex `.zst` support, Drive sharing, secret redaction and a handoff summary.

## Install (once per laptop)
Works on macOS, Windows and Linux: every push runs an end-to-end smoke test on all three (`.github/workflows/smoke.yml`).

Needs Node 22.15+. Then:
```
npm install -g @thevxmzstudio/carry   # also downloads txcript for your OS (checksum-verified); Linux may need sudo
carry install-skill                   # → /carry in Claude Code, Codex and ~/.agents
carry update                          # later: get the newest version (carry tells you when one is out)
```
Then pick a mode:
   - **Web Drive (default, nothing to install):** `carry setup --web --as <name> --with friend1@gmail.com,friend2@gmail.com`
     → Google sign-in opens in your browser. Shares are uploaded to a `carry` folder in your Drive and Google emails your friends a link.
   - **Synced folder:** `carry setup` (finds Google Drive for desktop on macOS and Windows) or `carry setup ~/Dropbox/carry`. Share the folder with friends in Drive/Dropbox.

## No terminal: MCP connector
carry runs as an MCP server, so you can just ask your AI app ("share this chat with riya@gmail.com", "open the carry link Riya sent me").
Needs Node; nothing else to install.

| App | Where | Add |
|---|---|---|
| Claude Desktop | Settings, Developer, Edit Config | `"mcpServers": { "carry": { "command": "npx", "args": ["-y", "@thevxmzstudio/carry@latest", "mcp"] } }` |
| Codex | `~/.codex/config.toml` | `[mcp_servers.carry]` `command = "npx"` `args = ["-y", "@thevxmzstudio/carry@latest", "mcp"]` |
| Cursor | `~/.cursor/mcp.json` | same JSON as Claude Desktop |

On Windows use `"command": "cmd", "args": ["/c", "npx", "-y", "@thevxmzstudio/carry@latest", "mcp"]`.
Tools: `carry_status`, `carry_connect_google_drive`, `carry_list_chats`, `carry_share_chat`, `carry_share_summary` (for chat apps,
whose history carry can't read), `carry_list_shared`, `carry_open` (returns the handoff and history, or loads it into a coding tool).

## Use
| Command | What it does |
|---|---|
| `carry list` | This laptop's chats (Claude Code, Codex) by name |
| `carry name <chat> <new name>` | Rename a chat |
| `carry share <chat> [--handoff f.md] [--with emails] [--link]` | Share it (secrets redacted). `--link` = anyone with the link |
| `carry share --project [dir] [--chats 5]` | Share the whole repo: recent chats + Claude memory + CLAUDE.md/AGENTS.md + handoff |
| `carry open <project> --to claude_code\|codex --dir <your clone>` | Memory lands where Claude loads it (Codex: `.carry/` + AGENTS.md pointer); chats resumable; nothing overwritten |
| `carry sync` | Re-upload shared chats that changed |
| `carry packs` | Synced mode: everyone's packs. Web mode: your shares and their links |
| `carry open <name \| file.carry \| Drive link> --to claude_code\|codex\|opencode\|cursor\|pi` | Continue it here, on this laptop's account |
| `carry open <…> --to chat` | Claude/ChatGPT/Antigravity apps: copies a prompt, shows handoff.md to attach |

In an AI tool with the skill installed, type `/carry` and it does the above with you.

A pack is one file, `<name>.carry` (JSON): `meta`, `handoff` (summary), `transcript` (readable history), `pack` (txcript Simple doc for native resume).

## Google sign-in app (one time, for the carry author)
Web mode needs one Google Cloud OAuth client. Users' data stays in their own Drive; this is only the app they sign in to.
1. https://console.cloud.google.com → new project `carry`.
2. APIs & Services → Library → enable **Google Drive API**.
3. OAuth consent screen (Google Auth Platform): External, app name `carry`, your support email.
   Scopes: add `.../auth/drive.file` only. While in Testing, add yourself and friends as test users.
4. Clients → Create client → **Desktop app** → copy the client ID and secret into `CLIENT` in `drive.js`
   (or env `CARRY_GOOGLE_CLIENT_ID` / `CARRY_GOOGLE_CLIENT_SECRET`).
5. To open it to everyone: Publish the app. `drive.file` is not a restricted scope, so no security audit; Google may still ask for brand verification.

Console wording above is from memory of Google's UI and may differ slightly.

Test: `npm test`. Plan and decisions: [status.md](status.md).

## Releasing (maintainers)
1. Bump `version` in package.json, add a `CHANGELOG.md` entry, bump `?v=` and the footer version in `site/`.
2. `git tag v<version> && git push --tags` → GitHub Actions tests on 3 OSes, publishes to npm and creates a GitHub Release.
   Needs the `NPM_TOKEN` repo secret. Working from a clone? Use `npm install && npm link` instead of the global install.
