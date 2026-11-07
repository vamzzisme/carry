---
name: carry
description: Share this AI chat (or open a friend's) through the user's own synced folder so it can be continued on another laptop, account or AI tool. Use when the user types /carry, or asks to share, hand off, transfer, carry over or continue a chat elsewhere.
---

# /carry

You drive the `carry` CLI for the user. Run the commands yourself; the user only signs in to Google in their browser.

## First run (not set up yet)
Run `carry packs`. If it says "No share folder yet" or "Not signed in", set up. Ask:
- what name friends should see them as (`--as`), and
- which friends' emails get their shares (`--with a@x.com,b@y.com`, optional).

Default: **web Drive** — nothing to install:
1. `carry setup --web --as <name> --with <emails>`. It opens Google's sign-in page in the browser.
2. Tell the user to sign in and allow access there. Never type passwords or codes for them. The command finishes on its own.
3. If it says "Google hasn't verified this app": that's expected while carry is in testing; they click Advanced → continue.

Alternative, if they already use Google Drive for desktop, Dropbox or iCloud and want a shared folder that syncs by itself:
`carry setup` (auto-finds Google Drive for desktop) or `carry setup <synced folder> --as <name>`. Friends share that folder in Drive's own UI.

## Share the current chat: `/carry share [name]`
1. `carry list` → find this chat (newest, matching what you're discussing). If unsure, show the user the top few and ask.
2. If they gave a name: `carry name <listed-name> <their-name>`.
3. Write a handoff to a temp file, from what you know of this chat:
   goal · what's done · current state (files, branch, commands) · decisions and why · open problems · next steps.
   Short, concrete, no secrets.
4. `carry share <name> --handoff <that file>` (add `--with <emails>` for extra people, `--link` for anyone-with-link).
   Report where it went (Drive link or folder) and how many secrets were redacted. In web mode Google emails the friends a link.
Shared chats can be refreshed later with `carry sync`.

## Share the whole project: `/carry share project`
Use when someone will keep working on this repo, not just this one chat.
1. Pick the project: `carry projects` lists them (name, chats, related chats, memory notes). If the user didn't say which,
   suggest the one for the current folder and confirm.
2. `carry projects <name>` shows its chats. Show the user: the chats started there (the newest 5 go by default) and the
   **related** chats (started elsewhere, e.g. the parent folder, that worked on this project's files). Ask which related
   ones to include; often this very conversation is one of them.
3. Write a project handoff to a temp file: what the project is, how it's structured, key decisions and why, what's done,
   what's in progress, gotchas, next steps. Concrete file paths; no secrets.
4. `carry share --project <name> --handoff <file>` plus `--add a,b` / `--skip c` / `--related` / `--chats N` as chosen,
   and `--with`/`--link` as above. It also bundles Claude Code's memory notes and CLAUDE.md / AGENTS.md. The code itself
   goes via git: remind the user to push.
To open one: `carry open <name or link> --to claude_code|codex --dir <their clone of the repo>`. Claude Code gets the memory notes
and a handoff note in its memory; Codex gets `.carry/` plus a pointer in AGENTS.md. Existing files are never overwritten.

## Friends: pair once, then inbox and return (preferred over emails and links)
- **Pair:** `carry friend add <their email>` prints a pairing code; the user sends it to the friend (any chat app). The friend runs
  `carry friend add <code>`, which prints a code back; the user runs `carry friend add <that code>`. `carry friends` shows status.
- **Send:** `carry share <chat> --to <friend>` or `carry share --project <name> --to <friend>`. Add `--auto-return` if the user
  wants the friend's carry to send it back on its own after they work on it.
- **Receive:** `carry inbox` lists what friends sent, numbered, including UPDATED items (the user's own shares coming back with
  the friend's work). Open with `carry open <number> --to claude_code|codex` (projects: add `--dir <their clone>`).
- **Return:** when work on a borrowed chat or project is done on this laptop, `carry return <chat>` or
  `carry return --project <name>` (optionally `--handoff <file>` summarising what was done). The owner sees it as UPDATED.
- If the owner also kept working on their copy, carry opens the friend's version next to theirs ("…-from-<friend>") and
  changes nothing; tell the user which is which. Code still goes through git: remind them to push and pull.
- `carry install-hook` (ask first; it edits ~/.claude/settings.json) runs `carry sync` after each Claude Code session, which
  returns `--auto-return` shares automatically.

## Open a shared chat: `/carry open [name or link]`
1. What to open: a Drive link the user got by email, a `.carry` file, or a name from `carry packs` (synced-folder mode).
   For a private Drive link, carry opens it in the browser; tell the user to click Download. carry picks it up from their Downloads folder.
   If the download landed elsewhere, run `carry open <path to the .carry file>`.
2. Ask where to continue if unclear:
   - Here / a coding tool → `carry open <name> --to <claude_code|codex|opencode|cursor|pi>` (tell the user it launches that tool with the chat loaded on this laptop's account).
   - The Claude desktop app → `carry open <name> --to claude_app`: the same Claude Code session, opened in the app's Code tab.
   - In a chat app (Claude app, ChatGPT, Antigravity app) → `carry open <name> --to chat`: copies a prompt and reveals handoff.md to attach.
   - To continue inside THIS conversation instead: `carry open <ref> --to chat`, then read the handoff.md it wrote
     (under `~/.carry/opened/<name>/`) yourself and carry on.

## Other
- `carry list` — this laptop's chats by name · `carry packs` — shared chats (web mode: your own shares with links) · `carry name <chat> <new>` — rename.
- If carry prints that a new version is out, tell the user and offer to run `carry update`.
- Never share a chat the user didn't pick.
