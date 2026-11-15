# How carry works (plain words)

carry is a small Node program. It doesn't run any server. It reads chats your AI tools already saved on your computer,
packs one into a file, puts that file in your Google Drive, and unpacks it on the other side.

## The files
| File | What it does |
|---|---|
| `carry.js` | The `carry` command. Finds chats, names them, builds packs, shares, opens. Everything starts here. |
| `drive.js` | Talks to Google Drive: browser sign-in, upload, share by email or link, download a link. |
| `system.js` | The few things that differ per OS: opening a browser, showing a file, the clipboard, finding Drive for desktop. |
| `mcp.js` | `carry mcp`: lets Claude Desktop, Codex or Cursor use carry as tools, without a terminal. |
| `install-txcript.js` | Runs on `npm install`: downloads the txcript program for your OS and checks its checksum. |
| `skills/carry/SKILL.md` | Instructions an AI follows when you type `/carry`. Copied in by `carry install-skill`. |
| `test.js`, `smoke.js`, `pkgtest.js` | Checks: small unit checks, a full run with fake chats, and installing the real package. |
| `site/` | The website (plain HTML, CSS, JS on Vercel). |

## A chat's journey
1. **Find.** Claude Code saves chats in `~/.claude/projects/<folder>/<id>.jsonl`; Codex in `~/.codex/sessions/.../rollout-*.jsonl.zst`
   (compressed; carry decompresses it). `sessions()` in carry.js lists them.
2. **Name.** carry reads the first real prompt (skipping IDE notes and reminders), removes secrets, and turns it into a name like
   `fix-the-login-bug-please`. Names are stored in `~/.carry/config.json`.
3. **Pack.** txcript (a library by SkillSync) converts the chat into one neutral format. carry removes secret-looking strings
   (`redact()`), adds a readable transcript and a short handoff, and saves it all as one `<name>.carry` file.
4. **Share.** Web mode uploads that file to a `carry` folder in your Drive and shares it (`drive.js`). Folder mode just writes it
   into a folder that Drive for desktop / Dropbox / iCloud syncs.
5. **Open.** On the other laptop carry reads the pack (from a link, a file, or the shared folder). For Claude Code or Codex it asks
   txcript to write a real session in that tool's format, with a new id and this laptop's folder, so `claude --resume` /
   `codex resume` continues it. For chat apps it writes `handoff.md` and copies a prompt to paste.

## Projects
`carry share --project` does the same for every recent chat in a repo, and adds Claude Code's memory notes for that repo and its
CLAUDE.md / AGENTS.md. Opening it into Claude Code puts the notes where Claude reads them at the start of a session; into Codex it
writes `.carry/` and a pointer line in AGENTS.md. Nothing that already exists gets overwritten.

## Friends, inbox and return
- **Pairing** (`carry friend add`): each direction (A to B, B to A) gets its own random key and an inbox file in the sender's
  Drive (or the shared synced folder). The pairing code carries the inbox's location and the key, so only the friend can read it.
- **Sending** (`share --to`): carry encrypts the pack with that friend's key (AES-256-GCM), puts it next to the inbox and adds a
  line to the inbox. In Drive these files are "anyone with the link": carry's Drive permission only sees files carry created,
  so the friend's carry reads them by link, and without the key they're unreadable.
- **Inbox** (`carry inbox`): reads every friend's inbox, decrypts it, numbers the items. `carry open <number>` opens one.
- **Borrowed work** is remembered (which friend, how many messages it had). `carry return` sends the continued chat back as an
  update. On the owner's side carry compares message counts: if the owner didn't keep going, the update becomes their chat;
  if they did, it opens next to theirs. Projects return their chats plus new memory notes; a note both changed is kept twice.
- `--auto-return` + `carry sync` (run by `carry install-hook` after each Claude Code session) sends borrowed work back on its own.

## Updates
carry checks npm at most once a day (in the background) and prints one line when a newer version exists. `carry update` installs it.
Releases: bump the version, add a CHANGELOG entry, push a `v*` tag; GitHub Actions tests on 3 OSes and publishes.
