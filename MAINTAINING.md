# Maintaining carry

Internal notes. Not shipped to npm (`files` in package.json). Dev log and decisions: [status.md](status.md).

## Develop
```bash
npm install && npm link   # fetches txcript into ./bin, links `carry` to this checkout
npm test                  # unit checks (redaction, names, links, versions)
node smoke.js             # full run with fake chats in a temp home
node pairtest.js          # three laptops sharing one folder: friends, inbox, return, conflicts, projects
node pkgtest.js           # pack + global install like a user, checks files and txcript
```
CI (`.github/workflows/smoke.yml`) runs all three on Linux, Windows and macOS, with the bundled npm and npm@latest.

## Release
1. Bump `version` in package.json, `.claude-plugin/plugin.json` and `server.json` (twice), and add a `CHANGELOG.md` entry.
2. Site: bump the footer version and the `?v=` on CSS/JS/icon links in `site/*.html`.
3. `git tag v<version> && git push origin main --tags`. `.github/workflows/publish.yml` tests, publishes to npm (skips if
   that version exists) and creates a GitHub Release from the changelog.
   - npm trusted publishing (no token): npmjs.com → `@heyvamz/carry` → Settings → Trusted Publisher → GitHub Actions,
     repo `vamzzisme/carry`, workflow `publish.yml`.
   - Until that's set, publish by hand: `npm publish` (asks for 2FA in the browser).
4. Site deploys from `main` to https://carry-si.vercel.app (Vercel project `carry-site`, root `site/`).
5. The workflow also builds `carry.mcpb` (`node mcpb/build.js`) and attaches it to the release; the site and README link to
   `releases/latest/download/carry.mcpb`.
6. MCP Registry (after npm has the version): `mcp-publisher login github` (once; device code in the browser), then
   `mcp-publisher publish` from the repo root. Name `io.github.vamzzisme/carry` must match `mcpName` in package.json.
7. Claude Code plugin: nothing to do, `vamzzisme/carry` is its own marketplace (`.claude-plugin/`). Check with
   `claude plugin validate .`. Directory listing: claude.ai/directory/manage → Submit new → Plugin bundle.

## Analytics (VXMZ-wide)
Self-hosted Umami 3.4 at https://vxmz-analytics.vercel.app (Vercel project `vxmz-analytics`, fork `vamzzisme/vxmz-analytics`).
Database: Neon project `vxmz-analytics` (`old-waterfall-99493096`, org thevxmzstudio, aws-us-east-1, Postgres 18).
Vercel env: `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL` (unpooled, for migrations), `APP_SECRET`. Local copy of the
Neon links: `../vxmz-analytics/.env.local` (git-ignored). carry's website id: `20a506c5-aa9e-4f87-9519-91c67c25e6df`.
Add another product: Umami → Websites → Add website, then the same `<script>` with its id and `data-domains`.
Update Umami: GitHub → `vamzzisme/vxmz-analytics` → Sync fork; Vercel redeploys and migrates.

## Google sign-in app (one time)
Web mode needs one Google Cloud OAuth client. Users' data stays in their own Drive; this is only the app they sign in to.
Project `carry` (`carry-513915`).
1. https://console.cloud.google.com → project → APIs & Services → Library → enable **Google Drive API**.
2. Google Auth Platform: External, app name `carry`, support email. Data Access: `.../auth/drive.file` only
   (Google lists it as non-sensitive). Audience: test users while in Testing (100 cap).
3. Clients → **Desktop app** → client ID and secret go into `CLIENT` in `drive.js` (or env `CARRY_GOOGLE_CLIENT_ID` /
   `CARRY_GOOGLE_CLIENT_SECRET`). Google treats desktop-app secrets as non-confidential; GitHub secret scanning flags them,
   allowed on purpose.
4. To leave Testing: Branding page → homepage `https://carry-si.vercel.app`, privacy `https://carry-si.vercel.app/privacy`
   → Publish app → brand verification.
