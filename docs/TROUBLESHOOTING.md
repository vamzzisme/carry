# Troubleshooting

**`carry: command not found` after install.** npm's global bin folder isn't on your PATH. Run `npm bin -g` (or `npm prefix -g`)
and add its `bin` folder to PATH, then open a new terminal. On Windows, open a new PowerShell window.

**`EACCES` / permission denied on `npm install -g` (Linux).** Use `sudo npm install -g @heyvamz/carry`, or install Node with nvm so
global installs don't need root.

**Couldn't get txcript.** carry downloads txcript on install (npm 11) or the first time it needs it (npm 12 blocks install
scripts). If that fails (offline, proxy), run `carry doctor` again once online, or install txcript yourself and put it on PATH.
Opening with `--to chat` or `--to here` doesn't need txcript. `carry doctor` shows which txcript carry uses.

**Google says "Google hasn't verified this app".** carry's Google sign-in is still in Google's testing stage. Click Advanced,
then continue. Only accounts added as test users can sign in until the app is verified.

**Sign-in times out / browser doesn't open.** carry prints the sign-in link; open it yourself. It waits 5 minutes.

**A friend's link opens in the browser instead of downloading.** It was shared privately (by email), so only their Google
account can read it. Click Download; carry picks the file up from Downloads. If it went elsewhere: `carry open <path to .carry>`.

**`carry list` doesn't show my Codex chats.** carry reads `~/.codex/sessions` (or `$CODEX_HOME/sessions`), both plain and
`.zst` files. Chats from the Antigravity app and from claude.ai / ChatGPT on the web can't be read; share a summary instead
(`carry note`, or `carry_share_summary` over MCP).

**A chat name looks wrong.** Names come from the first real prompt. Rename it: `carry name <chat> <new name>`.

**The MCP connector doesn't show up.** Restart the app after editing its config. Make sure Node is installed (`node -v`, 22.15+).
On Windows the config must use `"command": "cmd", "args": ["/c", "npx", ...]`.

**Opening a project changed nothing.** carry never overwrites existing files; it prints "kept your existing …" for those.
Merge by hand if you want the incoming version.

**Stop the "new version" notice.** Set `CARRY_NO_UPDATE_CHECK=1`.
