# Roadmap

## Before a public launch
- [ ] Google sign-in out of testing: add homepage + privacy URL on the Branding page, publish, request verification
      (`drive.file` is non-sensitive: brand review only, no security audit)
- [ ] Two-person test: share by email, friend opens the private link via browser download
- [ ] Try the MCP connector inside Claude Desktop, Codex and Cursor themselves
- [ ] Umami website id on the site; close the two GitHub secret-scanning alerts (client ID/secret, by design)
- [ ] npm trusted publisher for `@heyvamz/carry` (so `git tag vX` releases without a manual 2FA publish)

## Next
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
