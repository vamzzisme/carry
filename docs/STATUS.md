# Status — Shared Project Brain

Last updated: 2026-11-07 · Stage: **carry 0.4.4 released** (npm, Claude Code plugin, carry.mcpb, MCP Registry, site).
Positioning (7 Nov): "AirDrop for AI chats and projects", serverless (no carry server, own Google Drive). Build log at the bottom.
Notion page: https://app.notion.com/p/40e08c931db68187a8f8e7d3a41971ce (older than this file; this file wins)

## Product in one line
"AirDrop for AI chats": the user **picks** a chat or project in one AI tool/account, it's packed into a folder they own
(Google Drive / git), and anyone in their group continues it in **any** AI tool or account — Claude, ChatGPT, Codex,
Cursor, Antigravity. Goal: use leftover tokens across tools and accounts. Not a harness (we don't run the agent loop);
a portability layer. We host nothing. Opt-in only: nothing is shared unless the user picks it.

## Where chats live (checked on this Mac, 2026-11-06)
| Tool | Storage | Readable by us? |
|---|---|---|
| Claude Code | `~/.claude/projects/<path>/<id>.jsonl` (plain JSONL) | Yes |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.zst` (zstd JSONL) | Yes (decompress) |
| Antigravity | `~/.gemini/antigravity/conversations/<id>.db` (SQLite: `steps`, `trajectory_meta`, …) + `~/.gemini/antigravity/brain/<id>/` (`task.md`, `implementation_plan.md`) | Yes; DB schema to reverse-engineer, brain/*.md are plain |
| Claude app / claude.ai, ChatGPT app | Their servers | No direct read → handoff prompt (v1) or browser extension (later) |
| Cursor | Not installed here | Unverified |

Notable: Codex already imports Claude Code sessions natively (`~/.codex/external_agent_session_imports.json`, 8 imports here).
Full-history transfer between tools is doable; we just make it general, pickable and shareable.

## Verified Claude Code facts (tested 2026-11-06, v2.1.282)
- `claude --resume /abs/path/<id>.jsonl` resumes a copied transcript from another folder (tested)
- `autoMemoryDirectory` moves auto memory to any folder; recalled from another project path (tested). Useful for Claude-to-Claude project memory, secondary now.
- Hooks get `transcript_path`, `session_id`, `cwd`; SessionStart stdout is injected; SessionEnd ≤60 s, output discarded (docs)
- Plugin = hooks + skills + MCP; install via `claude plugin marketplace add owner/repo` (docs)
- Transcripts auto-deleted after 30 days (`cleanupPeriodDays`) (docs)

## Competitors (researched 2026-11-06) — DECISION PENDING
| Tool | What it covers | Gap vs us |
|---|---|---|
| **txcript / SkillSync** (YC; Apache-2.0 CLI free; Pro $20/seat/mo) | List/search sessions, native `continue` into Claude Code, Codex, Cursor, Antigravity, OpenCode…; reads claude.ai + ChatGPT via app login; `export` → file → `continue` on another machine; MCP; Pro: share by link/teammate | Sharing is paid + their cloud; no redaction or handoff summary stated |
| **session-migrate** (MIT, 171★) | Native migration across 18 harnesses incl. Antigravity, Cursor (text only) | Linux only now; no sharing, redaction, summary |
| **memex** (MIT, 307★) | Search/resume local history across ~19 tools; experimental text transfer; other machines via SSH | No group sharing |
| **supermemory** | Hosted memory layer (facts), not chat transfer | Different category |
| Browser extensions (MemoryPlugin, OpenMemory, AI Context Flow, …) | Memory across ChatGPT/Claude/Gemini web | Memory, not chat/project handoff; mostly cloud |
| Claude Code built-ins | Remote Control (drive a running session from another device), `--teleport` | Claude only; same account |
Our only unique bits left: free, user-owned group sharing (Drive folder), secret redaction, handoff.md summary.

**DECIDED (2026-11-06): build `carry`, a thin wrapper on txcript.** txcript does reading/converting/native continue.
`carry` adds: (1) names instead of IDs for chats and projects, (2) user-owned sharing, (3) secret redaction, (4) handoff.md.

### Transport decision (answers "A uses B's laptop")
- **Upload is automatic, zero cloud code:** `carry setup` (once) picks the share folder inside Google Drive for desktop's
  synced folder (`~/Library/CloudStorage/GoogleDrive-<email>/My Drive/carry/`). Writing a pack there = Drive uploads it.
  Needs Drive for desktop installed + signed in once on A's laptop (NOT installed on this Mac yet; checked 2026-11-06).
  Any synced folder works the same (Dropbox, iCloud Drive, OneDrive).
- **Updates are automatic:** user marks a chat once (`carry share <name>`). After that the pack is re-exported when the chat changes:
  Claude Code via SessionEnd hook; other tools via a launchd job running `carry sync` every 5 min.
- **Everything starts from `/carry` inside the AI tool.** One `SKILL.md` (Agent Skills format) tells the AI to drive the
  `carry` CLI and walk the user through setup. Checked on this Mac: `~/.agents/skills/<name>/SKILL.md` exists and its skills
  show up in Claude Code; Codex has `~/.codex/skills/`; Antigravity ships built-in skills in `~/.gemini/antigravity/builtin/skills/`
  (where Antigravity loads USER skills from: unverified). Chat apps (claude.ai, ChatGPT) have no shell → they only receive packs as attachments.
- Bootstrap (unavoidable, once): `npx carry install` → installs the CLI + copies the skill into every detected tool.
- `/carry` first run (AI does it, user only signs in + picks friends):
  1. `carry status` → no share folder? check `~/Library/CloudStorage/GoogleDrive-*`
  2. Drive missing → ask, then `brew install --cask google-drive` (cask exists, checked) → `open -a "Google Drive"`
  3. User signs in to Google themselves (AI never types passwords) → AI re-checks the folder → `carry setup --folder <it>`
  4. Asks friends' emails → opens drive.google.com on the folder; user clicks Share (Drive's own dialog)
- Then: `/carry share` (names the current chat), `/carry list`, `/carry open auth-bug`.
- **Chat apps via local MCP (`carry mcp`, stdio, same CLI underneath):**
  - Claude desktop app: YES — local MCP via `.mcpb` desktop extension (one-click) or `claude_desktop_config.json` (file exists here).
  - ChatGPT desktop app: LIKELY — reportedly runs local stdio MCP through its built-in Codex engine, sharing `~/.codex/config.toml`
    (this Mac: app 26.1103, config already has local `[mcp_servers.*]`). Not tested end to end.
  - claude.ai web/mobile, ChatGPT web: NO — remote HTTPS connectors only → would need hosting → out of scope.
  - Chat apps can't read their OWN history via MCP; `share_current_chat` = the AI writes handoff.md from what it sees in context.
- A pack is ONE file: `<name>.carry` (zip: handoff.md, transcript.md, txcript export JSON, meta.json, optional code snapshot).
- `carry` never logs into Google or calls any cloud API. It only writes/reads a local folder.
- Ways the file gets to B's laptop, user's choice:
  1. **Group folder (set up once):** A shares a Drive folder with B's Google account. On B's laptop, Google Drive for desktop
     (already logged in as B) syncs it after "Add shortcut to Drive". `carry list` on B then shows A's packs by name. A never logs in on B's laptop.
  2. **Ad hoc:** AirDrop / WhatsApp / email / USB the `.carry` file, or A opens drive.google.com in a private window on B's laptop and downloads it.
- On B's laptop the chat continues on **B's** AI account (that's the point: use B's tokens).
- Code: travels via git (`git clone`), or the optional code snapshot in the pack (excludes `.env`, `node_modules`, `.git`).
- `carry open --temp` → delete the pack and `.handoff/` after use (someone else's laptop).
- UNVERIFIED: Drive-for-desktop "Add shortcut to Drive" step for shared folders; check before writing the README.

## txcript npm package — tested 2026-11-06 (installed: `txcript@0.14.4`, Apache-2.0, in ./node_modules)
- It is the **WASM library only** (no CLI, no `bin`). API: `toCommon(text, from)`, `convert(text, from, to)`, `fromCommon`,
  `harnesses()`, `searchTranscript`, `Searcher`. 17 harnesses incl. `claude_code`, `codex`, `antigravity`, `cursor`, `claude_chat`, `chatgpt`.
- Works on real sessions here: Claude Code jsonl → common (10 msgs, meta: id, timestamp, cwd, git_branch, model) → Codex (34 lines).
  Codex `.jsonl.zst` (decompress with Node 26 built-in `zlib.zstdDecompressSync`) → common (36 msgs) → Claude Code (37 lines).
- **meta has NO title** → our naming feature is needed (derive from first user prompt + cwd, user can rename).
- Library does NOT: find sessions on disk, write converted sessions where the target tool looks, read Antigravity's SQLite
  (expects "JSON dump of the conversation database"; dump shape unknown). The Rust CLI (`txcript list/continue`) does
  discovery + native write; not installed (no cargo; release binaries on GitHub). Decide: use CLI binary vs. do discovery/write ourselves.

## txcript CLI — tested 2026-11-06 (v0.14.4, `~/.local/bin/txcript`, GitHub release, sha256 verified)
Commands: `list`, `continue`, `export`, `view`, `query`, `crop`, `mcp`. **Decision: carry wraps this CLI.**
- ✅ **Handoff works end to end:** `txcript export <id> > pack.json` (9.6 KB portable JSON) →
  `txcript continue pack.json --with claude_code --no-resume --out <dir>` → `claude -p --resume <file>` from another folder
  correctly summarized the original chat. `--with codex` also wrote a rollout file (`codex resume <id>`; Codex CLI not installed here → untested).
- ✅ `list` finds Claude Code sessions (14) and Hermes. Title column for Claude Code = cwd path → useless; **our names are needed**.
- ❌ **Codex: 0 found.** This Codex writes `rollout-*.jsonl.zst`; txcript only reads plain `.jsonl` (confirmed: decompressed copy under
  `CODEX_HOME=<dir>` is listed). carry must decompress (Node `zlib.zstdDecompressSync`) before handing to txcript.
- ❌ **Antigravity app: 0 found.** txcript reads `~/.gemini/antigravity-cli` (CLI), not the app's `~/.gemini/antigravity/conversations/*.db`.
  Antigravity app = handoff.md path only, unless we write a DB→JSON adapter.
- ⚠️ `list --from claude_chat` hangs (needs Claude Desktop login/org); keep cloud sources out of v1.
- ⚠️ Export keeps the original session id; `continue` into the same tool on the same machine may clash with the original.
- No secret redaction in txcript: export contains whatever was in the chat. carry must redact before writing to the shared folder.

## Ruled out (don't revisit)
- supermemory.ai and SMFS: hosted / cloud-backed. We are the user-owned alternative.
- Auto-syncing everything: user picks what's shareable.
- Summaries via an LLM API key: the AI tools themselves write/read the handoff with the user's existing tokens.

## Design v1
### The pack (one folder per shared chat or project, inside the shared folder)
```
<shared-folder>/<date>-<who>-<title>/
  handoff.md      goal, decisions, done, current state, next steps, key files (short; any AI reads this first)
  transcript.md   full chat as readable Markdown, tool noise trimmed (attach when the target can take it)
  native/         original file (e.g. Claude Code .jsonl) → exact resume in the same tool
  meta.json       source tool, account label, project path/git remote, created, redaction applied
```
Project = git repo (code travels via git, not us) + one or more chats + `handoff.md`.

### CLI `carry` (one small tool, macOS first)
- `carry list` — recent chats across detected tools (Claude Code, Codex, Antigravity) with titles/dates; user picks.
- `carry share <chat>` — builds the pack into the shared folder; redacts secrets; `handoff.md` left as a stub if no summary yet.
- `carry open <pack> --to <tool>`:
  - same tool, native available → exact resume (Claude Code: `claude --resume <path>`)
  - Claude Code / Codex / Cursor / Antigravity → drop pack into the repo as `.handoff/` and print/copy:
    "Read .handoff/handoff.md (and transcript.md if needed), then continue."
  - Claude app / ChatGPT / Gemini web → copy that prompt to clipboard + reveal files to attach.

### Who writes `handoff.md` (no API key)
- Before leaving: in-chat command in the source tool (`/carry` skill in Claude Code; a pasteable prompt elsewhere) — source tokens.
- Or after arriving: target AI reads `transcript.md` and summarizes itself — target tokens.
- Cloud chats (claude.ai, ChatGPT): user pastes the handoff prompt into that chat, saves the answer as `handoff.md`.

### Groups
Shared Drive folder = group inbox. Pack names carry author + date. Everyone runs `carry`.

## Known limits (accepted for v1)
- Exact full-history resume only within the same tool (and same format version). Cross-tool = handoff + transcript, not a native resume.
- Long transcripts exceed context; `handoff.md` is the always-works path.
- Regex redaction catches common secret shapes, not all.
- Cloud chat export is manual (prompt) until a browser extension exists.

## Web Drive (no desktop app) — DECIDED 2026-11-06: support BOTH modes (web default, synced folder optional). Built in v0.2.
Without Drive for desktop, carry must call the Google Drive API itself → needs a Google OAuth client.
- **rclone: ruled out.** Its shared client ID "is being retired and will stop working during 2026" (rclone.org/drive) →
  every user would have to create their own Google Cloud OAuth client. Bad UX.
- **Own OAuth app (we register ONE Google Cloud "Desktop app" client, ship its ID in carry; data still only in users' Drives):**
  - Scope `drive.file` (only files carry created) is the light one. Broad `drive`/`drive.readonly` = restricted → security assessment. Avoid.
  - Catch: with `drive.file`, B's carry **cannot see files A shared with B**. So sharing = A's carry uploads `<name>.carry`, then shares it
    (by friends' emails → Google emails them a link; or "anyone with link"). B runs `carry open <drive link>` → download via link.
  - First use opens Google sign-in in the browser (the "web Drive" step). Until the OAuth app is verified/published, users see
    "Google hasn't verified this app" (testing mode: limited test users; UNVERIFIED details: 100-user cap, 7-day token expiry).
  - The user (app author) must create the Google Cloud project + OAuth client themselves (console.cloud.google.com).
- Synced-folder mode (Drive for desktop / Dropbox / iCloud) stays as is: no OAuth, no Google review.

## Build log
### v0.1 (2026-11-06) — `carry.js` (one file), `test.js`, `skills/carry/SKILL.md`, README
- Commands: `setup [folder] [--as name]`, `list`, `name`, `share [--handoff f]`, `sync`, `packs`, `open <pack> --to <tool|chat>`.
- Uses txcript **library** for reading/converting (toCommon/fromCommon "simple"), txcript **CLI** only for `continue` (native write + launch).
- Our discovery: `~/.claude/projects/*/*.jsonl` + `~/.codex/sessions/**/rollout-*.jsonl[.zst]` → Codex chats now listed (txcript alone: 0).
- Names: slug of first real prompt (strips IDE/system wrappers, `[Request interrupted]`), redacted first, fallback `chat-<folder>`. Stored in `~/.carry/config.json`.
- `open` rewrites `id` (fresh UUID, no clash with original) and `cwd` (= where you run it; paths differ per laptop).
- Tested: `npm test` ok. This 28c277cf session (large) → renamed `carry-project` → shared (14 redactions, all fake test keys) →
  opened from another folder with `--to claude_code` → `claude -p --resume` correctly described the project.
- Bugs found while testing, fixed: names built from IDE "user opened file" notes; **a real Sarvam key (`sk_…`) became a chat name** →
  names are now built from redacted text and `sk_` is covered.
- Not tested: `--to codex` resume (Codex CLI not installed), `--to chat` (opens Finder), Google Drive (not installed here), `sync`.

### v0.2 (2026-11-06) — web Drive + single-file packs
- `drive.js`: Google sign-in in the browser (loopback 127.0.0.1 + PKCE, scope `drive.file`, refresh token in `~/.carry/google.json`, mode 600),
  create `carry` folder, multipart upload / in-place update, share by email (Google sends the link) or `--link` (anyone with link),
  public download for link-shared files; private links → opens the browser and picks the file up from `~/Downloads`.
- Pack is now ONE file `<name>.carry` = `{carry:1, meta, handoff, transcript, pack}`. AI-written handoff kept in `~/.carry/handoffs/`
  so `sync` doesn't overwrite it with the stub.
- `setup --web [--as] [--with emails]` / `setup [folder]`; `share --with/--link`; `open <name | file.carry | Drive link>`.
- Tested: `npm test` (adds Drive link parsing). Synced mode end to end: this chat (507 msgs, 680 KB pack, 20 redactions) → opened by
  file path and by name from another folder → `claude -p --resume` answered correctly. `publicDownload` on a bad id → null (fallback ok).
- Google Cloud set up 2026-11-06: project `carry` (`carry-513915`), Drive API enabled, consent screen External/Testing
  (100 test-user cap), scope `drive.file` only (Google lists it as non-sensitive), Desktop client `carry desktop` → `CLIENT` in drive.js.
- ✅ **Web mode tested for real:** `setup --web` (browser sign-in, after fixing the address()-after-close crash) →
  `share you-re-setting-up-sarvam --link` uploaded to Drive → `open <drive link> --to claude_code` from another folder →
  `claude -p --resume` described the chat correctly. Test file left in Drive with anyone-with-link access (user can delete).
- Not tested yet: sharing by email (`--with`), private-link open via browser download, `sync` in web mode.

### Website (2026-11-06) — `site/` (static, no build)
- `index.html` (hero, how it works, tools, privacy band, install, FAQ, feedback via mailto), `privacy.html`, `terms.html`,
  `style.css`, `main.js`, `favicon.svg`, `vercel.json` (`cleanUrls` → `/privacy`, `/terms`).
- VXMZ standard: "A VXMZ PRODUCT" curtain (once per session, tap to skip), "built by @heyvxmz" → x.com/heyvxmz, version v0.2.0,
  Boska + Inter + IBM Plex Mono, studio ink/paper/lime + moss green band, pill navbar with 01–04 links + drawer < 768px,
  primary/secondary/text buttons with scale(.98), Buy me a coffee, studio link, light + dark. No em dashes.
- Checked in browser: 1280 desktop and 390 mobile, dark and light, no horizontal scroll on all 3 pages.
- Local preview: `.claude/launch.json` → `carry-site` (python http.server :4321; `/privacy` 404s locally, `.html` works).
- Before deploy: create GitHub repo `vamzzisme/carry` (install section + footer link to it), Umami website id (commented script in
  index.html; privacy page already says Umami), then deploy to Vercel. Privacy page includes Google's Limited Use statement,
  needed later for Google OAuth verification (homepage + privacy URL).

### Shipped (2026-11-06)
- Repo: https://github.com/vamzzisme/carry (public, `main`). GitHub push protection flagged the Google client secret and client ID
  in `drive.js:12`; user allowed both ("I'll fix it later"), so the repo has 2 secret-scanning alerts to close as won't-fix.
- Site: https://carry-si.vercel.app (Vercel project imported from the repo, root `site/`; `/privacy`, `/terms` OK).
  Pushes to `main` redeploy it.

### Cross-platform (2026-11-06)
- `system.js`: open URL (`open` / `rundll32 url.dll,FileProtocolHandler` / `xdg-open`), reveal file (`open -R` / `explorer /select,` /
  `xdg-open <dir>`), clipboard (`pbcopy` / `clip` / `wl-copy`→`xclip`→`xsel`), Drive for desktop folder (macOS CloudStorage,
  Windows `<letter>:\My Drive`, Linux none → web mode). Falls back to printing the link/prompt if a command fails.
- Already portable: session paths via `os.homedir()`, Node zstd, txcript has Windows/Linux builds.
- ✅ Tested on real Linux, Windows and macOS: `.github/workflows/smoke.yml` (GitHub Actions, Node 24, txcript v0.14.4 per OS)
  runs `npm test` + `smoke.js` on every push. smoke.js makes fake Claude Code + Codex(.zst) chats in a temp home and runs
  setup, list, share (redaction), packs, open --to chat, open --to claude_code / codex (--no-resume). Run 42252021983: all 3 green,
  and CI fails if txcript is missing so the open steps can't be skipped.
  (No Docker engine on this Mac: `docker` CLI only, no Desktop/Colima.)
- Install is now commands only: `npm install` runs `install-txcript.js` (postinstall) → checksum-verified txcript for the OS in
  `./bin` (gitignored); carry uses `$TXCRIPT`, else `./bin`, else PATH. `carry install-skill` copies `skills/carry` into
  `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills` (whichever exist). CI run 42254571617 (no manual txcript step): 3/3 green.
- MCP (2026-11-06): `mcp.js` stdio JSON-RPC server (`carry mcp`), no new deps, 7 tools; each runs the CLI as a child process.
  New CLI bits for it: `carry note "<name>" --handoff f` (summary-only pack, `pack: null`), `open --to here` (prints handoff +
  transcript). Tested: smoke.js MCP session (initialize, tools/list, list, share_summary, open, status); real client
  `claude -p --mcp-config` called carry_status + carry_list_chats; `npx -y github:vamzzisme/carry mcp` from GitHub works.
  Not tested: inside Claude Desktop / Codex / Cursor apps themselves; long carry_connect_google_drive may hit client tool timeouts.
- Site: OS tabs (auto-detect, remembered, synced across sections) for install; new 05 "No terminal" section with app tabs
  (Claude Desktop / Codex / Cursor) × OS (Windows uses `cmd /c npx`).
- Product styling (2026-11-06): no hero eyebrow, no "by vxmz" in navbar (VXMZ only in curtain + footer); carry accent
  Marigold `#e9a23b` (band `#241c13`, light-mode text `#9a5b12`; was Harbor Teal briefly), macOS window dots on terminals; rule + per-product colour table added to
  `../VXMZ_STUDIO_STANDARD.md` section 1b. Hero terminals animate (type → swap → type → loop); CSS/JS links carry `?v=3`, bump on changes.
- Name check (2026-11-06): renaming touches 316 mentions in 18 files + repo name + Vercel project + Google OAuth app name.
  npm name doesn't matter (we install from GitHub). Free everywhere checked: `batonai`. Short words (baton, relay, ferry, handoff…) taken on npm.
- Positioning (2026-11-06): for coding agents. Copy-paste summaries are fine for chat apps; carry wins on long Claude Code /
  Codex sessions (full history incl. errors and dead ends, resumed as the agent's own session) and on whole projects.
  Web remote MCP connector: decided NOT to build (would only move summaries).
- Projects (2026-11-06): `carry share --project [dir] [--chats 5]` → kind:"project" pack: newest chats whose cwd is inside the
  repo (git toplevel), Claude memory from `~/.claude/projects/<cwd with non-alnum→->/memory/*.md`, CLAUDE.md, AGENTS.md,
  .claude/CLAUDE.md, handoff (redacted). `open --to claude_code --dir X`: memory + `carry-handoff-<name>.md` note into X's
  Claude memory dir, MEMORY.md merged line-wise, instruction files only if absent, chats converted (newest last).
  `--to codex|…`: `.carry/HANDOFF.md`, `.carry/memory/`, AGENTS.md pointer line. `--to here|chat`: brief + latest chat.
  MCP `carry_share_project`, `carry_open` takes `dir`. Verified for real: a fresh Claude Code session in the opened folder
  answered a payment-provider decision from carried memory and "pnpm" from carried CLAUDE.md.
  Not done: `sync` doesn't refresh project packs.
- 0.4.0 (2026-11-07, unpublished): `carry projects` (git-root grouping, related chats by path mentions >= 3, --add/--skip/
  --related), friends (pair codes `carry1.<base64url json>`, per-direction AES-256-GCM key + inbox file, `sent-…carry`,
  `carry inbox`, `open <n>`, borrowed/borrowedProjects records, `carry return`, UPDATED + conflict by message count,
  projects return new chats + memory with `.from-<friend>.md` on conflict, --auto-return via sync, install-hook).
  `continueIn` now always writes with --no-resume, captures the new id, then `launch()`es the tool.
  Tests: pairtest.js (A/B/C, folder mode) in CI; real Claude resumed A's returned chat and knew B's additions.
  NOT tested: friends over real Google Drive (two accounts).
- Smoke test caught a real bug: `KEY=sk-...` counted as 2 redactions. Fixed (KEY=value skips `[REDACTED]`).
- Not covered on Windows/Linux: Google web sign-in (needs a browser + human), resuming inside the real AI tools.

## Next steps (in order)
1. [x] Analytics: self-hosted Umami at vxmz-analytics.vercel.app (Vercel + Neon org thevxmzstudio, project old-waterfall-99493096);
       carry site tracked (website id 20a506c5-...), verified 1 visit 2026-11-07. Google sign-in published (by Vamshi).
       Clay red accent (#c2674b) live.
1b. [x] 0.4.1 (2026-11-07): Claude Code plugin (repo is its own marketplace), carry.mcpb on every GitHub release
       (built by mcpb/build.js in publish.yml), MCP Registry io.github.vamzzisme/carry, tool titles + read-only/write hints.
       Next: submit plugin at claude.ai/directory/manage (Plugin bundle); double-click .mcpb in Claude Desktop (untested).
1c. [x] 0.4.2 released 2026-11-07 (npm, GitHub release + carry.mcpb, MCP Registry, site): Drive file/folder recreate, own links via API,
       open by name in web mode, numbered picker, `carry completion zsh` (tested with stubbed compadd, not a real Tab press). ChatGPT app: carry added to
       ~/.codex/config.toml, unverified whether ChatGPT chat mode loads it.
1d. [x] 0.4.3 released 2026-11-07 (npm, release + mcpb, registry, site): short pairing codes (carry2), setup turns on zsh completion, open --to claude_app / codex_app
       (app links), ChatGPT's bundled codex + npx fallback. Two-account friend test done by Vamshi with 0.4.2.
1e. [x] 0.4.4 released 2026-11-07: Tab completion for bash + PowerShell (completions/), setup picks the shell; CI checks all 3 OS.
2. [ ] Test with a friend: `share --with <their gmail>` → they `carry open <emailed link>` (private, browser download path)
2. [ ] Auto-sync: Claude Code SessionEnd hook + launchd job for `carry sync`
3. [ ] `carry install`: copy skill into each detected tool, check txcript CLI, `npm link`
4. [ ] Test `--to codex` with the Codex CLI; Antigravity app adapter (DB → JSON) or handoff-only
5. [ ] `carry mcp` for Claude desktop / ChatGPT desktop apps
6. [ ] Optional code snapshot in pack; `open --temp` cleanup
7. [ ] Publish (npm name `carry` availability unchecked), VXMZ Product Standard docs
