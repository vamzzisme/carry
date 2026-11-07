# carry

**Out of tokens? Keep coding.**

carry moves a Claude Code or Codex session, with its full history, to another account, another tool or a friend's
laptop. Or hand over a whole project, memory and all, so the next agent knows what was tried and why.

Shared chats go into **your own** Google Drive. There is no carry server and no account with us.

[Website](https://carry-si.vercel.app) · [GitHub](https://github.com/vamzzisme/carry) · built by [@heyvamz](https://x.com/heyvamz) · A VXMZ product

## Why not just paste a summary?

A summary keeps what the AI chose to remember. carry keeps every message, command, error and dead end, and the next
agent resumes it as its own session, so it doesn't retry the fix that already failed.

## Install

Needs [Node](https://nodejs.org) 22.15 or newer. Works on macOS, Windows and Linux.

```bash
npm install -g @heyvamz/carry
carry install-skill                 # adds /carry to Claude Code and Codex
carry setup --web --as yourname     # sign in to Google Drive in your browser
```

On Linux you may need `sudo npm install -g @heyvamz/carry`.

Already use Google Drive for desktop, Dropbox or iCloud? Run `carry setup` (or `carry setup ~/Dropbox/carry`) instead and
share that one folder with your group.

## Use it

Inside Claude Code or Codex, type `/carry` and it walks you through everything. Or from a terminal:

```bash
carry list                                         # your chats, by name
carry share fix-the-login-bug --with riya@gmail.com  # Google emails Riya the link
```

On the other laptop:

```bash
carry open <drive link> --to codex                 # or --to claude_code
```

The chat opens on whichever account is signed in there.

### Share a whole project

```bash
carry projects                      # your repos, with chats and Claude memory notes
carry projects my-app               # the chats in one, plus "related" chats started elsewhere that worked on it
carry share --project my-app --add <related chat> --with riya@gmail.com
```

It bundles the newest chats (and any you add), Claude Code's memory notes, CLAUDE.md / AGENTS.md and a handoff. The code itself goes
through git. Your friend clones the repo, then:

```bash
carry open <drive link> --to claude_code --dir ./the-repo
```

Claude Code gets your memory notes and a handoff note where it reads them at the start of a session; Codex gets a
`.carry/` folder and a pointer in AGENTS.md. Nothing of theirs is overwritten.

### Chat apps

claude.ai, ChatGPT and the Claude app keep chats on their servers, so carry shares a written summary there:
`carry open <link> --to chat` copies a prompt and shows the `handoff.md` to attach.

## No terminal? Ask your AI

carry also runs as an MCP connector. Add it once, then just say "share this chat with Riya" or "open the carry link
Riya sent me".

**Claude Desktop** (Settings, Developer, Edit Config) and **Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "carry": { "command": "npx", "args": ["-y", "@heyvamz/carry@latest", "mcp"] }
  }
}
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.carry]
command = "npx"
args = ["-y", "@heyvamz/carry@latest", "mcp"]
```

On Windows, use `"command": "cmd"` and put `"/c", "npx"` at the start of the args. Restart the app after saving.

## Commands

| Command | What it does |
|---|---|
| `carry list` | Your Claude Code and Codex chats, by name |
| `carry name <chat> <new name>` | Rename a chat |
| `carry share <chat> [--with emails] [--link]` | Share a chat. `--link` lets anyone with the link open it |
| `carry projects [name]` | Your projects, or the chats in one (including related chats started elsewhere) |
| `carry share --project [name] [--add chats] [--skip chats] [--related]` | Share a whole repo |
| `carry open <link, file or name> --to claude_code\|codex\|chat` | Continue it here |
| `carry packs` | What you've shared |
| `carry sync` | Re-upload shared chats that changed |
| `carry note "<name>" --handoff summary.md` | Share just a summary (from a chat app) |
| `carry doctor` | Versions, txcript, and how sharing is set up |
| `carry update` | Get the newest version. carry tells you when one is out |

## Privacy

- carry runs on your computer. Chats go from your computer to your Google Drive and nowhere else.
- It asks Google for the narrowest Drive permission: it can only see files it created.
- API keys, tokens, private keys and `KEY=value` lines are replaced with `[REDACTED]` before anything leaves your laptop.
  This is pattern based, so don't share chats full of secrets you care about.
- Nothing is shared unless you pick it.

Full policy: [carry-si.vercel.app/privacy](https://carry-si.vercel.app/privacy)

## Notes

- Google may show "Google hasn't verified this app" while carry is in Google's testing stage. Click Advanced, then continue.
- Stop the daily update check with `CARRY_NO_UPDATE_CHECK=1`.
- Something not working? See [Troubleshooting](https://github.com/vamzzisme/carry/blob/main/TROUBLESHOOTING.md).

Built on [txcript](https://github.com/skillsynchq/txcript) by SkillSync, which converts chats between tools.
Apache-2.0 license.
