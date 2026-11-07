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

Inside Claude Code or Codex, type `/carry` and it walks you through everything. Or from a terminal.

### With friends: pair once, then just pick from your inbox

```bash
# You
carry friend add riya@gmail.com        # prints a pairing code: send it to Riya (any chat app)
# Riya
carry friend add <your code>           # prints her code back
# You
carry friend add <Riya's code>         # done, both ways
```

Then:

```bash
# You
carry list                                       # your chats, by name
carry share fix-the-login-bug --to riya          # into Riya's inbox
# Riya
carry inbox                                      # 1. fix-the-login-bug   chat from you   NEW
carry open 1 --to codex                          # continues on Riya's account (or --to claude_code)
carry return fix-the-login-bug                   # when she's done: back to you, with her work
# You
carry inbox                                      # 1. fix-the-login-bug   UPDATED by Riya (+18 messages)
carry open 1 --to claude_code                    # continue from the latest
```

If you also kept working on your copy meanwhile, carry opens Riya's version next to yours and overwrites nothing.
Add `--auto-return` when sharing to have her carry send it back on its own (run `carry install-hook` for Claude Code).
Everything Riya's carry reads is encrypted with a key that only lives in your pairing codes.

### Without pairing

```bash
carry share fix-the-login-bug --with riya@gmail.com   # Google emails Riya a link
carry open <drive link> --to codex                    # on Riya's laptop
```

### Share a whole project

```bash
carry projects                      # your repos, with chats and Claude memory notes
carry projects my-app               # the chats in one, plus "related" chats started elsewhere that worked on it
carry share --project my-app --add <related chat> --to riya
```

It bundles the newest chats (and any you add), Claude Code's memory notes, CLAUDE.md / AGENTS.md and a handoff. The code
itself goes through git. Riya clones the repo, then `carry open <number> --to claude_code --dir ./my-app`, and later
`carry return --project my-app` brings back her chats and any memory notes Claude picked up.

Claude Code gets your memory notes and a handoff note where it reads them at the start of a session; Codex gets a
`.carry/` folder and a pointer in AGENTS.md. Nothing of theirs is overwritten.

### Chat apps

claude.ai, ChatGPT and the Claude app keep chats on their servers, so carry shares a written summary there:
`carry open <link> --to chat` copies a prompt and shows the `handoff.md` to attach.

## No terminal? Ask your AI

carry also runs as an MCP connector. Add it once, then just say "share this chat with Riya", "what's in my carry inbox?"
or "send it back to Riya".

**Claude Desktop, one click:** download [carry.mcpb](https://github.com/vamzzisme/carry/releases/latest/download/carry.mcpb)
and double-click it.

**Claude Code plugin** (connector + `/carry` skill together):

```bash
claude plugin marketplace add vamzzisme/carry
claude plugin install carry@carry
```

**Claude Desktop by hand** (Settings, Developer, Edit Config) and **Cursor** (`~/.cursor/mcp.json`):

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
| `carry friend add <email or code>` · `carry friends` | Pair once with a friend; see who's paired |
| `carry share <chat> --to <friend> [--auto-return]` | Into their inbox |
| `carry inbox` · `carry open <number>` | What friends sent you, including your own chats coming back UPDATED |
| `carry return <chat>` · `carry return --project <name>` | Send borrowed work back to its owner |
| `carry share <chat> [--with emails] [--link]` | Share without pairing. `--link` lets anyone with the link open it |
| `carry projects [name]` | Your projects, or the chats in one (including related chats started elsewhere) |
| `carry share --project [name] [--add chats] [--skip chats] [--related] [--to friend]` | Share a whole repo |
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
- We collect nothing. carry has no server and no telemetry; the only network calls are to Google Drive (your account),
  npm (update check) and GitHub (downloading txcript once).
- Shared files stay in your Drive until you delete them there. Local settings live in `~/.carry/` until you delete that folder.
- Who sees a shared chat is up to you: paired friends, the emails you name, or anyone with the link if you choose `--link`.
- Contact: pvamshikrishna369@gmail.com

Full policy: [carry-si.vercel.app/privacy](https://carry-si.vercel.app/privacy)

## Notes

- Google may show "Google hasn't verified this app" while carry is in Google's testing stage. Click Advanced, then continue.
- Stop the daily update check with `CARRY_NO_UPDATE_CHECK=1`.
- Something not working? See [Troubleshooting](https://github.com/vamzzisme/carry/blob/main/TROUBLESHOOTING.md).

Built on [txcript](https://github.com/skillsynchq/txcript) by SkillSync, which converts chats between tools.
Apache-2.0 license.
