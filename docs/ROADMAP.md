# Roadmap

## Before a public launch
- [x] Google sign-in: Branding page + publish (done by Vamshi, 2026-11-07)
- [ ] Two-person test: share by email, friend opens the private link via browser download
- [ ] Try the MCP connector inside Claude Desktop, Codex and Cursor themselves
- [x] Umami: self-hosted at vxmz-analytics.vercel.app (Neon Postgres), tracking carry-si.vercel.app
- [ ] Close the two GitHub secret-scanning alerts (client ID/secret, by design)
- [ ] npm trusted publisher for `@heyvamz/carry` (so `git tag vX` releases without a manual 2FA publish)

## Next
- [x] Projects list, related chats, choose chats (0.4.0)
- [x] Friends: pairing, encrypted inbox, return with updates and conflict handling, auto-return (0.4.0)
- [ ] Test friends over real Google Drive with two accounts (CI covers folder mode only)
- [ ] Received copies in your own Drive (`received/`), so they follow you to every laptop
- [ ] `carry sync` refreshes project packs too; automatic sync (Claude Code SessionEnd hook, a scheduled `carry sync`)
- [ ] `carry open --temp`: remove the pack and its files after use on someone else's laptop
- [ ] Optional code snapshot in packs for repos without a shared remote
- [ ] Move the package to a studio npm org when one is available (deprecate `@heyvamz/carry` with a pointer)

## Later
- [ ] Antigravity app chats (its SQLite conversations), not just the Antigravity CLI
- [ ] Browser extension to export claude.ai / ChatGPT web chats as packs
- [ ] Semantic search across shared packs

## Decided against
- Remote (web) MCP connector: web apps would only get summaries, which people can already paste.
- Hosting anything: carry stays local; packs live in the user's own Drive.
