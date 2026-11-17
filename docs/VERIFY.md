# carry: what to verify

Run it before every release and after any change a user will see. Each line passes, fails or is not run, with
evidence. Fix failures before the release checklist (`../VXMZ_STUDIO_STANDARD.md` section 7), never by loosening a check.

- `[auto]` lines run with one command, from the repo root. It reads the carry checkout and the live site, changes
  nothing, and exits 1 if anything fails:
  ```bash
  node verify.js                  # everything
  node verify.js release site     # skip the test suites (they take a few minutes)
  ```
- `[browser]` lines need the browser pane. `[human]` lines need Vamshi (real accounts, real apps).

## The CLI
- `[auto]` Unit checks: redaction (including `sk_` keys), chat names, links, versions: `npm test`
- `[auto]` End to end in a temp home: setup, list, share with redaction, packs, `open --to chat / claude_code / codex`,
  an MCP session: `node smoke.js`
- `[auto]` Friends across three temp laptops: pair, send, inbox, open, return, update, conflict, projects, auto-return:
  `node pairtest.js`
- `[auto]` Packed like `npm publish`, installed globally into a temp prefix: shipped files, txcript on first use,
  `carry --version`: `node pkgtest.js`
- `[human]` Two Google accounts: `share --with <gmail>`, the friend opens the emailed link in a browser
- `[human]` The MCP connector inside Claude Desktop, Codex and Cursor themselves

## Release consistency
- `[auto]` One version everywhere: `package.json`, `.claude-plugin/plugin.json`, `server.json` (twice), the signature on
  every site page
- `[auto]` `CHANGELOG.md` has an entry for that version (an "Unreleased" section is reported, not failed)
- `[auto]` What's published matches: npm `latest`, the GitHub latest release with `carry.mcpb`, the MCP Registry's latest

## Site (https://carry-si.vercel.app)
A preview behind Vercel Authentication: `CARRY_VIA=vercel CARRY_SITE=<preview URL> CARRY_REPO=<worktree> node verify.js site` (reads through the logged-in `vercel curl`, ignores the vercel.live script a preview injects).
- `[auto]` Pages answer 200: `/`, `/docs`, `/blog`, `/privacy`, `/terms`, `/setup.md`, `/robots.txt`, `/sitemap.xml`, `/og.png`
- `[auto]` Security headers on `/`: `x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`
- `[auto]` The live home page is the committed `site/index.html` (nothing undeployed, nothing deployed by hand)
- `[auto]` Studio standard on the home page: Kit signature footer with the version, Umami with carry's website id, FAQ,
  feedback form, Buy me a coffee, link to the studio, meta description
- `[auto]` Sharing and search tags: `og:title`, `og:description`, `og:image`, `twitter:card`, canonical link,
  `robots.txt`, `sitemap.xml`
- `[browser]` At a 390px viewport no page scrolls sideways (`document.documentElement.scrollWidth` is 390 on `/`,
  `/docs`, `/blog`, `/privacy`, `/terms` and every post); the console is clean; on `/docs` the OS tabs switch every
  group at once and the choice survives a reload; "Copy setup prompt" copies exactly
  "Set up carry for me. Read https://carry-si.vercel.app/setup.md and follow it."
  Use the browser pane's viewport, not a headless Chrome screenshot (that one lays out wider than 390 and crops).
