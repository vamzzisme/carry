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

## Updates
carry checks npm at most once a day (in the background) and prints one line when a newer version exists. `carry update` installs it.
Releases: bump the version, add a CHANGELOG entry, push a `v*` tag; GitHub Actions tests on 3 OSes and publishes.
