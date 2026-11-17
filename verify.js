// node verify.js [suites] [release] [site]  →  the [auto] lines of VERIFY.md, each PASS / FAIL / INFO with evidence.
// Reads this repo (or CARRY_REPO) and the live site; changes nothing there. Exits 1 if anything fails. No npm install.
// A branch before release: CARRY_REPO=<worktree> CARRY_SITE=<preview URL> node verify.js
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');

const REPO = path.resolve(process.env.CARRY_REPO || __dirname);
const SITE = (process.env.CARRY_SITE || 'https://carry-si.vercel.app').replace(/\/$/, '');
const UMAMI_ID = '20a506c5-aa9e-4f87-9519-91c67c25e6df', PAGES = ['/', '/docs', '/blog', '/privacy', '/terms', '/setup.md', '/robots.txt', '/sitemap.xml', '/og.png'];
const want = process.argv.slice(2), on = s => !want.length || want.includes(s);

const results = [];
const fail = m => { throw new Error(m); };
async function check(name, fn) {
  const t = Date.now();
  try { const r = await fn(); const [state, ev] = Array.isArray(r) ? r : ['PASS', r]; results.push([state, name, ev]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
  const [state, , ev] = results.at(-1);
  console.log(`${state.padEnd(4)}  ${name}  (${Math.round((Date.now() - t) / 1000)}s)\n      ${String(ev).split('\n').join('\n      ')}`);
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', timeout: 10 * 60e3 });
  const lines = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').map(l => l.trim()).filter(Boolean);
  if (r.status !== 0) fail(`exit ${r.status ?? r.signal}: ${lines.slice(-3).join(' | ')}`);
  return lines.at(-1) || 'exit 0';
};
const file = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const json = f => JSON.parse(file(f));
// CARRY_VIA=vercel: read SITE through the logged-in `vercel curl` (a preview behind Vercel Authentication). Plain path unchanged.
const get = async url => {
  if (process.env.CARRY_VIA === 'vercel' && url.startsWith(SITE)) {
    const r = spawnSync('vercel', ['curl', url.slice(SITE.length) || '/', '--deployment', SITE, '--', '-s', '-i'], { encoding: 'utf8', maxBuffer: 1e8 });
    const out = r.stdout || '', i = out.indexOf('\r\n\r\n'), head = out.slice(0, i).split('\r\n');
    return { status: +head[0].split(' ')[1], text: out.slice(i + 4), headers: Object.fromEntries(head.slice(1).map(l => [l.split(':')[0].toLowerCase(), l.slice(l.indexOf(':') + 1).trim()])) };
  }
  const r = await fetch(url, { redirect: 'follow' });
  return { status: r.status, text: await r.text(), headers: Object.fromEntries(r.headers) };
};
const pages = () => ['site', 'site/blog'].flatMap(d => fs.readdirSync(path.join(REPO, d)).filter(f => f.endsWith('.html')).map(f => `${d}/${f}`));
const version = () => json('package.json').version;

(async () => {
  if (!fs.existsSync(path.join(REPO, 'package.json'))) fail(`no carry checkout at ${REPO}`);
  console.log(`carry ${version()} at ${REPO}\n`);

  if (on('suites')) {
    await check('npm test (unit)', () => run('npm', ['test']));
    await check('smoke.js (end to end, temp home)', () => run(process.execPath, ['smoke.js']));
    await check('pairtest.js (friends, three temp laptops)', () => run(process.execPath, ['pairtest.js']));
    await check('pkgtest.js (packed + global install, temp prefix)', () => run(process.execPath, ['pkgtest.js']));
  }

  if (on('release')) {
    await check('one version everywhere', () => {
      const v = version(), server = json('server.json');
      const found = { 'plugin.json': json('.claude-plugin/plugin.json').version, 'server.json': server.version,
        'server.json packages': server.packages.map(p => p.version).join(','),
        ...Object.fromEntries(pages().map(p => [p, (file(p).match(/<vxmz-signature[^>]*version="v?([^"]+)"/) || [])[1]])) };
      const off = Object.entries(found).filter(([, x]) => x !== v);
      if (off.length) fail(`package.json is ${v}; differs: ${off.map(([k, x]) => `${k} ${x}`).join(', ')}`);
      return `${v} in package.json, plugin.json, server.json (x2) and ${pages().length} site pages`;
    });
    await check('CHANGELOG entry for this version', () => {
      const log = file('CHANGELOG.md'), v = version();
      if (!new RegExp(`^## \\[?v?${v.replace(/\./g, '\\.')}\\b`, 'm').test(log)) fail(`no "## ${v}" heading in CHANGELOG.md`);
      const unreleased = (log.match(/^## Unreleased\n([\s\S]*?)(?=^## )/m) || [])[1]?.trim();
      return unreleased ? ['INFO', `entry for ${v} found; "Unreleased" holds changes not yet shipped: ${unreleased.split('\n')[0].slice(0, 140)}`] : `entry for ${v} found, nothing unreleased`;
    });
    await check('published versions match', async () => {
      const v = version();
      const npm = JSON.parse((await get('https://registry.npmjs.org/@heyvamz%2fcarry')).text)['dist-tags'].latest;
      const gh = JSON.parse((await get('https://api.github.com/repos/vamzzisme/carry/releases/latest')).text);
      const reg = JSON.parse((await get('https://registry.modelcontextprotocol.io/v0/servers?search=io.github.vamzzisme/carry')).text).servers
        .find(s => s.server.name === 'io.github.vamzzisme/carry' && s._meta?.['io.modelcontextprotocol.registry/official']?.isLatest)?.server.version;
      const ev = `npm ${npm}, GitHub ${gh.tag_name} (${(gh.assets || []).map(a => a.name).join(', ') || 'no assets'}), MCP Registry ${reg}`;
      const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
      if (npm !== v && newer(v, npm)) return ['INFO', `local ${v} is not released yet; published: ${ev}`]; // a release branch, before the yes
      if (npm !== v || gh.tag_name !== `v${v}` || !(gh.assets || []).some(a => a.name === 'carry.mcpb') || reg !== v) fail(`local ${v}; ${ev}`);
      return ev;
    });
  }

  if (on('site')) {
    await check('pages answer 200', async () => {
      const codes = await Promise.all(PAGES.map(async p => [p, (await get(SITE + p)).status]));
      const bad = codes.filter(([, c]) => c !== 200);
      if (bad.length) fail(bad.map(([p, c]) => `${p} ${c}`).join(', '));
      return codes.map(([p, c]) => `${p} ${c}`).join(', ');
    });
    const home = (await get(SITE + '/')).text;
    await check('live home page is the committed site/index.html', () => {
      const local = file('site/index.html').replace(/\n$/, '').split('\n'), live = home.replace(/\n$/, '').split('\n').filter(l => !(process.env.CARRY_VIA === 'vercel' && l.includes('vercel.live/_next-live/feedback'))), i = local.findIndex((l, n) => l !== live[n]);
      if (i === -1 && local.length === live.length) return 'identical';
      if (i === -1) fail(`every line matches but local has ${local.length} lines, live ${live.length}`);
      fail(`first difference at line ${i + 1}: local "${(local[i] || '').trim().slice(0, 80)}" vs live "${(live[i] || '').trim().slice(0, 80)}"`);
    });
    await check('studio standard on the home page', () => {
      const need = { 'Kit signature script': /thevxmzstudio\.vercel\.app\/kit\/signature\.js/, [`signature version v${version()}`]: new RegExp(`<vxmz-signature[^>]*version="v${version().replace(/\./g, '\\.')}"`),
        'Umami (carry id)': new RegExp(`data-website-id="${UMAMI_ID}"`), FAQ: /id="faq"/, 'feedback form': /<form/, 'Buy me a coffee': /buymeacoffee\.com\/thevxmzstudio/,
        'studio link': /thevxmzstudio\.vercel\.app/, 'meta description': /<meta name="description"/ };
      const missing = Object.keys(need).filter(k => !need[k].test(home));
      if (missing.length) fail('missing: ' + missing.join(', '));
      return Object.keys(need).join(', ');
    });
    await check('sharing and search tags', async () => {
      const tags = { 'og:title': /property="og:title"/, 'og:description': /property="og:description"/, 'og:image': /property="og:image"/,
        'twitter:card': /name="twitter:card"/, canonical: /rel="canonical"/ };
      const missing = Object.keys(tags).filter(k => !tags[k].test(home));
      for (const f of ['/robots.txt', '/sitemap.xml']) if ((await get(SITE + f)).status !== 200) missing.push(f);
      if (missing.length) fail('missing: ' + missing.join(', '));
      return 'all present';
    });
    await check('security headers on the home page', async () => {
      const h = (await get(SITE + '/')).headers, need = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'];
      const missing = need.filter(k => !h[k]);
      if (missing.length) fail('missing: ' + missing.join(', '));
      return need.map(k => `${k}: ${h[k]}`).join('; ');
    });
    // no 390px screenshot here: headless Chrome lays the page out wider than 390 and crops it, which looks like overflow.
    // Phone width is a [browser] line in VERIFY.md (the browser pane emulates a real 390px viewport).
  }

  const n = s => results.filter(r => r[0] === s).length;
  console.log(`\n${n('PASS')} pass, ${n('FAIL')} fail, ${n('INFO')} info`);
  process.exit(n('FAIL') ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
