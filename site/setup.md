# Set up carry (instructions for an AI assistant)

You are helping a person set up **carry**, a free, open-source tool that moves an AI coding chat (Claude Code or Codex),
or a whole project, to a friend, another account or another AI tool through the person's own Google Drive.
Website: https://carry-si.vercel.app · Docs: https://carry-si.vercel.app/docs · Source: https://github.com/vamzzisme/carry

carry runs on the person's own computer. There is no carry account and no carry server.

## Rules for you

- Never type passwords or sign in for the person. Google sign-in happens in their browser; they click Allow themselves.
- Ask before installing anything. Explain each step in one short sentence.
- Do not invent commands or flags. Use only the ones on this page or in `carry --help`.

## 1. Find out where you are running

- **You can run shell commands** (Claude Code, Codex, Cursor agent, or similar): follow "Terminal setup" below.
- **You cannot run commands** (claude.ai, ChatGPT in the browser, a phone app): carry needs to run on the person's
  computer. Tell them so, then follow "Desktop app setup" below. Do not pretend to run commands.

## 2. Terminal setup

1. Check Node: `node -v`. carry needs **Node 22.15 or newer**. If it is missing or older, help them install it
   (macOS: `brew install node`; Windows: `winget install OpenJS.NodeJS.LTS`, then open a new terminal;
   Linux: their package manager or https://nodejs.org).
2. Install carry: `npm install -g @heyvamz/carry` (on Linux this may need `sudo`).
3. Check it: `carry doctor`. It shows versions and downloads txcript (the chat converter) if it is missing.
4. Add the `/carry` command to Claude Code and Codex: `carry install-skill`.
5. Ask the person for the name friends should see, then connect Google Drive:
   `carry setup --web --as <name>`. A browser window opens; they sign in to Google and click Allow.
   Setup also turns on Tab completion for chat and friend names (zsh, bash or PowerShell); tell them to open a new terminal afterwards.
   - If they already use Google Drive for desktop, Dropbox or iCloud and prefer a synced folder: `carry setup`
     (or `carry setup <folder>`) instead. No Google sign-in needed.
6. Show their chats: `carry list`. Explain they can now say "share this chat with <friend>" or run `/carry`.

## 3. Desktop app setup (no terminal)

carry works as an MCP connector inside desktop AI apps. The person needs Node 22.15+ installed (https://nodejs.org).

- **Claude Desktop (easiest):** download https://github.com/vamzzisme/carry/releases/latest/download/carry.mcpb and
  double-click it.
- **Claude Code plugin:** `claude plugin marketplace add vamzzisme/carry`, then `claude plugin install carry@carry`.
- **Codex:** add to `~/.codex/config.toml`:
  ```toml
  [mcp_servers.carry]
  command = "npx"
  args = ["-y", "@heyvamz/carry@latest", "mcp"]
  ```
- **Cursor:** add to `~/.cursor/mcp.json` (Claude Desktop by hand: Settings, Developer, Edit Config):
  ```json
  { "mcpServers": { "carry": { "command": "npx", "args": ["-y", "@heyvamz/carry@latest", "mcp"] } } }
  ```
- On Windows use `"command": "cmd"` with `"/c", "npx"` at the start of the args. Restart the app afterwards.

Then the person just asks: "Connect carry to my Google Drive", "Share this chat with Riya", "What's in my carry inbox?"

## 4. What to tell them next

- Pair with a friend once: `carry friend add <their email>`, send the printed code, and run `carry friend add <their code>`
  with the code they send back.
- Share: `carry share <chat> --to <friend>`. The friend runs `carry inbox` and `carry open 1 --to codex`
  (or `claude_code` for the terminal, `claude_app` / `codex_app` to open it in the Claude or Codex desktop app).
- Send work back: `carry return <chat>`.
- Whole project: `carry projects`, then `carry share --project <name> --to <friend>`.
- Secrets (API keys, tokens, `KEY=value` lines) are redacted before anything leaves the computer. It is pattern based.
- Full docs: https://carry-si.vercel.app/docs
