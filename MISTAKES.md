# Mistakes

## Chat name built from a real API key
- When: `carry list` naming chats from the first user prompt (`named()` in carry.js)
- Did: slugged the raw prompt
- Symptom: a chat was named after a real Sarvam key pasted 23 days earlier (`sk-<key>-the-sarvam`); names are shown in the shared folder
- Cause: names come from user content, and Sarvam keys are `sk_…` (underscore), which the `sk-` pattern missed
- Rule: build every visible label from `redact(text)`; when adding a provider, add its key shape to `SECRET_PATTERNS` and to `test.js`

## Names from IDE wrappers
- When: first prompt of Claude Code chats started from VS Code
- Did: stripped only tag brackets, kept inner text
- Symptom: names like `the-user-opened-the-file`
- Cause: the IDE injects `<ide_opened_file>…</ide_opened_file>` as a user text block
- Rule: `cleanPrompt` drops `<ide_*>`, `<system-reminder>`, `<command-*>` blocks with their contents; check names with `carry list` after changes

## Sign-in crashed after Google redirected back
- When: `carry setup --web`, `signIn()` in drive.js, first real Google sign-in
- Did: built the redirect URI from `srv.address().port` after calling `srv.close()`
- Symptom: `TypeError: Cannot read properties of null (reading 'port')`; user had to sign in twice
- Cause: Node's `server.address()` returns null once the server is closed
- Rule: capture the redirect URI once in the `listen` callback and reuse it for the token exchange

## Assumed npm runs install scripts
- When: v0.3.0 published; `install-txcript.js` as `postinstall` was the only way txcript got installed
- Did: relied on postinstall
- Symptom: publish workflow (npm@latest = 12) failed pkgtest; npm 12 warns "install scripts blocked because they are not covered by allowScripts"
- Cause: npm 12 blocks dependency/global install scripts by default
- Rule: never depend on install scripts; fetch on first use (`txcriptPath()`), and run pkgtest with both bundled npm and npm@latest

## Unix command in a cross-platform test
- When: `pairtest.js` `continueSession()` located session files with `execSync('find ...')`
- Did: shelled out to `find`
- Symptom: GitHub Actions windows-latest failed at "Run node pairtest.js"; Linux/macOS passed
- Cause: on Windows `find` is a different program (text search), not Unix find
- Rule: tests and carry code use Node `fs` for file lookups; no shell utilities except `tar`/`git`, which exist on all three runners

## `carry name` took only one word
- When: `node carry.js name so-i-have-a-project carry project`
- Did: read only `args[1]`
- Symptom: renamed to `carry`, then `share carry-project` → "No chat named…"
- Rule: commands taking free text join the remaining args

## Pushed the release tag right after a hand `npm publish`
- When: 0.4.2 release, `git push origin main --tags` seconds after the user's `npm publish` printed `+ @heyvamz/carry@0.4.2`
- Did: assumed npm shows the version immediately
- Symptom: publish.yml "Publish (skipped if this version is already on npm)" failed (`npm view` still said 0.4.1), so no GitHub Release and no carry.mcpb
- Cause: npm takes minutes to list a new version ("Your package is being processed")
- Rule: wait until `curl -s 'https://registry.npmjs.org/@heyvamz%2fcarry'` shows the version as latest, then push the tag (publish.yml now also retries after 120 s). Re-run a failed run from the Actions page; deleting and re-pushing a tag is blocked
