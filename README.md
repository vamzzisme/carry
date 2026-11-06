# carry

Share an AI chat by name, and continue it on another laptop, another account, or another AI tool.
Chats go into **your** Google Drive (or Dropbox/iCloud). Nothing is hosted by us.

Site: https://carry-site-beta.vercel.app · v0.2.0 · built by [@heyvxmz](https://x.com/heyvxmz)

Built on [txcript](https://github.com/skillsynchq/txcript). carry adds names, Codex `.zst` support, Drive sharing, secret redaction and a handoff summary.

## Install (once per laptop)
1. Node 22.15+ and the txcript CLI: download from https://github.com/skillsynchq/txcript/releases into `~/.local/bin/`.
2. `npm install && npm link` in this folder → `carry` command.
3. Copy `skills/carry/` into your AI tool's skills folder (`~/.agents/skills/` or `~/.claude/skills/` for Claude Code, `~/.codex/skills/` for Codex) → `/carry` in chat.
4. Pick a mode:
   - **Web Drive (default, nothing to install):** `carry setup --web --as <name> --with friend1@gmail.com,friend2@gmail.com`
     → Google sign-in opens in your browser. Shares are uploaded to a `carry` folder in your Drive and Google emails your friends a link.
   - **Synced folder:** `carry setup` (finds Google Drive for desktop) or `carry setup ~/Dropbox/carry`. Share the folder with friends in Drive/Dropbox.

## Use
| Command | What it does |
|---|---|
| `carry list` | This laptop's chats (Claude Code, Codex) by name |
| `carry name <chat> <new name>` | Rename a chat |
| `carry share <chat> [--handoff f.md] [--with emails] [--link]` | Share it (secrets redacted). `--link` = anyone with the link |
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
