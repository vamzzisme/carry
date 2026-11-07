#!/usr/bin/env node
// carry: share AI chats by name through a folder you own. Wraps txcript (https://github.com/skillsynchq/txcript).
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');
const tx = require('txcript');
const drive = require('./drive');
const { openTarget, reveal, copyText, driveFolder } = require('./system');

const HOME = os.homedir();
const CONF = path.join(HOME, '.carry', 'config.json');
const HEAD_BYTES = 256 * 1024; // enough of a session to find its first prompt
// txcript: $TXCRIPT, else the copy `npm install` put in ./bin, else one carry fetched into ~/.carry/bin, else PATH.
// npm 12 blocks install scripts by default, so if none exists carry downloads it on first use.
const TX = require('./install-txcript');
const BUNDLED = path.join(__dirname, 'bin', TX.EXE);
function findTxcript() {
  if (process.env.TXCRIPT) return process.env.TXCRIPT;
  for (const p of [BUNDLED, path.join(TX.USER_DIR, TX.EXE)]) if (fs.existsSync(p)) return p;
  return spawnSync('txcript', ['--version']).error ? null : 'txcript';
}
async function txcriptPath() {
  const found = findTxcript();
  if (found) return found;
  console.error(`Fetching txcript ${TX.VERSION} (one time)...`);
  try { return await TX.install(TX.USER_DIR); }
  catch (e) { die(`Couldn't get txcript (${e.message}). Install it from https://github.com/skillsynchq/txcript/releases and put it on PATH.`); }
}

// ---------- config ----------
function load() {
  try { return JSON.parse(fs.readFileSync(CONF, 'utf8')); } catch { return { names: {}, shared: {} }; }
}
function save(c) { fs.mkdirSync(path.dirname(CONF), { recursive: true }); fs.writeFileSync(CONF, JSON.stringify(c, null, 2)); }
function needFolder(c) {
  if (!c.folder) die('No share folder yet. Run: carry setup [folder]');
  return c.folder;
}
function die(msg) { console.error(msg); process.exit(1); }

// ---------- finding sessions ----------
function walk(dir, test, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out); else if (test(e.name)) out.push(p);
  }
  return out;
}
function sessions() {
  const cc = path.join(HOME, '.claude', 'projects');
  const claude = (fs.existsSync(cc) ? fs.readdirSync(cc) : []).flatMap(d => {
    try { return fs.readdirSync(path.join(cc, d)).filter(f => f.endsWith('.jsonl')).map(f => path.join(cc, d, f)); } catch { return []; }
  }).map(file => ({ harness: 'claude_code', file }));
  // Codex writes rollout-*.jsonl.zst; txcript only reads plain .jsonl, so we decompress ourselves.
  const codex = walk(path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'sessions'), n => /^rollout-.*\.jsonl(\.zst)?$/.test(n))
    .map(file => ({ harness: 'codex', file }));
  return [...claude, ...codex].map(s => ({ ...s, mtime: fs.statSync(s.file).mtimeMs, id: idOf(s.file) }))
    .sort((a, b) => b.mtime - a.mtime);
}
function idOf(file) {
  const m = path.basename(file).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
  return m ? m[1] : path.basename(file);
}
function readSession(s, headOnly) {
  let buf = fs.readFileSync(s.file);
  if (s.file.endsWith('.zst')) buf = zlib.zstdDecompressSync(buf);
  let text = buf.toString('utf8');
  if (headOnly && text.length > HEAD_BYTES) text = text.slice(0, text.lastIndexOf('\n', HEAD_BYTES));
  return text;
}
function common(s, headOnly) { return JSON.parse(tx.toCommon(readSession(s, headOnly), s.harness)); }

// ---------- names ----------
function textOf(m) {
  const parts = typeof m.content === 'string' ? [m.content] : (m.content || []).filter(b => b.type === 'text').map(b => b.text);
  return parts.join('\n\n').trim();
}
function cleanPrompt(t) {
  // Drop harness-injected wrappers (IDE file notes, reminders, slash-command echoes) with their contents.
  return t.replace(/<(ide_[a-z_]+|system-reminder|command-[a-z]+|local-command-[a-z]+)[^>]*>[\s\S]*?(<\/\1>|$)/g, ' ')
    .replace(/<\/?[a-z_-]+[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function firstPrompt(c) {
  for (const m of c.messages) if (m.role === 'user') {
    const t = cleanPrompt(textOf(m));
    if (t && !/^\[[A-Za-z_ ]+\]/.test(t)) return t; // skip "[Request interrupted by user]", "[external_agent_tool_result]"
  }
  return '';
}
function slug(t) {
  return t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean).slice(0, 5).join('-') || 'chat';
}
function uniqueName(c, base) {
  const used = new Set(Object.values(c.names));
  let n = base, i = 2;
  while (used.has(n)) n = `${base}-${i++}`;
  return n;
}
// Name every session we haven't seen; returns [{...session, name, prompt}].
function named(c, limit) {
  const list = sessions().slice(0, limit);
  for (const s of list) {
    const key = `${s.harness}:${s.id}`;
    if (c.names[key]) continue;
    let p = '', cwd = ''; try { const cm = common(s, true); p = firstPrompt(cm); cwd = cm.meta.cwd || ''; } catch {}
    // Names are visible in the shared folder, so never build one from a secret.
    const base = slug(redact(p).text.replace(/\[REDACTED\]/g, ' '));
    c.names[key] = uniqueName(c, base !== 'chat' ? base : slug(`chat ${path.basename(cwd)}`));
  }
  save(c);
  return list.map(s => ({ ...s, name: c.names[`${s.harness}:${s.id}`] }));
}
function find(c, ref) {
  const all = named(c, Infinity);
  return all.find(s => s.name === ref) || all.find(s => s.id.startsWith(ref)) || die(`No chat named or id-prefixed "${ref}". Try: carry list`);
}

// ---------- redaction ----------
// Runs on the serialized JSON, so patterns never cross a quote or backslash and the JSON stays valid.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk[-_][A-Za-z0-9_-]{20,}/g,                    // OpenAI, Anthropic (sk-ant-...), Sarvam (sk_...)
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,                           // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/g,                       // Google API key
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,                  // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /(Bearer\s+)[A-Za-z0-9._~+/-]{20,}/g,
  /((?:[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)[A-Z0-9_]*)\s*[=:]\s*)(?!\[REDACTED\])[^\s"'\\,]{8,}/g, // FOO_API_KEY=value, unless already redacted above
];
function redact(s) {
  let count = 0;
  for (const re of SECRET_PATTERNS) s = s.replace(re, (m, keep) => { count++; return (typeof keep === 'string' ? keep : '') + '[REDACTED]'; });
  return { text: s, count };
}

// ---------- pack ----------
function transcriptMd(doc) {
  const out = [`# ${doc.name}\n`, `From ${doc.from} · ${doc.cwd || ''}\n`];
  for (const m of doc.messages) {
    const t = m.role === 'user' ? cleanPrompt(textOf(m)) : textOf(m);
    if (t) out.push(`## ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${t}\n`);
  }
  return out.join('\n');
}
function handoffStub(doc) {
  const asst = doc.messages.filter(m => m.role === 'assistant').map(textOf).filter(Boolean);
  return [`# Handoff: ${doc.name}`, '',
    '_Auto stub. For a real summary run `/carry handoff` in the original chat._', '',
    `**Started with:** ${firstPrompt(doc).slice(0, 1000)}`, '',
    `**Last assistant reply:** ${(asst[asst.length - 1] || '').slice(0, 2000)}`, '',
    'Full history: transcript.md'].join('\n');
}
// A pack is one JSON file, <name>.carry: { carry, meta, handoff, transcript, pack (txcript Simple doc) }.
function buildPack(c, s, handoffFile) {
  const doc = JSON.parse(tx.fromCommon(JSON.stringify(common(s, false)), 'simple'));
  const { text, count } = redact(JSON.stringify(doc));
  const clean = JSON.parse(text);
  // The AI-written handoff is kept locally so `sync` doesn't replace it with a stub.
  const kept = path.join(path.dirname(CONF), 'handoffs', `${s.name}.md`);
  let handoff;
  if (handoffFile) {
    handoff = redact(fs.readFileSync(handoffFile, 'utf8')).text;
    fs.mkdirSync(path.dirname(kept), { recursive: true });
    fs.writeFileSync(kept, handoff);
  } else {
    try { handoff = fs.readFileSync(kept, 'utf8'); } catch { handoff = handoffStub({ ...clean, name: s.name }); }
  }
  const meta = { name: s.name, from: s.harness, by: c.user, cwd: clean.cwd, updated: new Date().toISOString(), redacted: count };
  return { carry: 1, meta, handoff, transcript: transcriptMd({ ...clean, name: s.name, from: s.harness }), pack: clean };
}

// Upload to the carry Drive folder. If the user deleted the old file, make a new one; if they deleted the folder, recreate it.
async function driveUpload(c, name, text, id) {
  try { return await drive.upload(name, text, c.web.folderId, id); }
  catch (e) {
    if (!/not found/i.test(e.message)) throw e;
    if (id) return driveUpload(c, name, text);
    c.web.folderId = await drive.makeFolder('carry'); save(c);
    return drive.upload(name, text, c.web.folderId);
  }
}

// Synced-folder mode writes the file and lets Drive/Dropbox/iCloud upload it; web mode uploads through the Drive API.
async function publish(c, name, p, { emails = [], link = false } = {}) {
  const body = JSON.stringify(p), prev = c.shared[name] || {};
  let where;
  if (c.web) {
    const f = await driveUpload(c, `${name}.carry`, body, prev.fileId);
    if (f.id !== prev.fileId) delete prev.fileId; // a new file: share it again
    const to = emails.length ? emails : prev.fileId ? [] : (c.friends || []); // first share goes to your friends
    if (to.length || link) await drive.share(f.id, to, link, `${c.user} shared the AI chat "${name}" with you. Continue it with: carry open <this link>`);
    prev.fileId = f.id; where = f.webViewLink;
  } else {
    where = path.join(needFolder(c), `${name}.carry`);
    fs.writeFileSync(where, body);
  }
  return { prev, where };
}
async function share(c, s, opts = {}) {
  const p = buildPack(c, s, opts.handoffFile);
  const { prev, where } = await publish(c, s.name, p, opts);
  c.shared[s.name] = { ...prev, harness: s.harness, id: s.id, mtime: s.mtime, count: p.pack.messages.length, where };
  save(c);
  return { where, count: p.meta.redacted };
}

// Names you can open: your web shares, or the packs in the synced folder.
function packNames(c) {
  if (c.web) return Object.keys(c.shared).filter(n => c.shared[n].fileId);
  const dir = c.folder && fs.existsSync(c.folder) ? c.folder : null;
  return dir ? fs.readdirSync(dir).filter(f => f.endsWith('.carry')).map(f => f.slice(0, -6)) : [];
}
// The first plain argument, or ask: "carry share" alone lists the newest and you type a number. Not in scripts or MCP (no TTY).
async function pickArg(args, what, rows, usage) {
  if (args[0] && !args[0].startsWith('--')) return args[0];
  if (!rows.length || !process.stdin.isTTY) die(usage);
  rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}. ${r}`));
  const rl = require('readline/promises').createInterface({ input: process.stdin, output: process.stdout });
  const n = Number(await rl.question(`Which ${what}? [1] `) || 1); rl.close();
  return rows[n - 1]?.split(' ')[0] || die('No such number.');
}

// Read a pack from a Drive link, a .carry file, or a name in the synced folder.
async function readPack(c, ref) {
  const id = drive.fileIdFrom(ref);
  let text;
  if (id) text = await drive.ownDownload(id) || await drive.publicDownload(id) || await viaBrowser(ref);
  else if (ref.endsWith('.carry') && fs.existsSync(ref)) text = fs.readFileSync(ref, 'utf8');
  else if (c.web) { // your own shares, by name; friends' arrive as Drive links
    const id = c.shared[ref]?.fileId || die(`No share named "${ref}". Try: carry packs, or open the Drive link.`);
    text = await drive.ownDownload(id) || die(`Couldn't download "${ref}" from Drive. Was it deleted? Share it again: carry share ${ref}`);
  } else {
    const f = path.join(needFolder(c), `${ref}.carry`);
    if (!fs.existsSync(f)) die(`No pack "${ref}". Try: carry packs`);
    text = fs.readFileSync(f, 'utf8');
  }
  const p = JSON.parse(text);
  if (p.carry !== 1) die('Not a carry pack.');
  return p;
}

// Privately shared files can't be fetched without the friend's Google login, so let their browser (already signed in) download it.
async function viaBrowser(link) {
  const dl = path.join(HOME, 'Downloads'), ls = () => fs.readdirSync(dl).filter(n => n.endsWith('.carry'));
  const before = new Set(ls());
  console.log(`Opening the link in your browser. Click Download; carry picks the file up from ${dl}.`);
  if (!openTarget(link)) console.log(`Couldn't open a browser. Open this link yourself:\n${link}`);
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const f = ls().find(n => !before.has(n));
    if (f) return fs.readFileSync(path.join(dl, f), 'utf8');
  }
  die(`No .carry file showed up in ${dl} within 3 minutes. If it went elsewhere, run: carry open <path to the .carry file>`);
}

// ---------- projects ----------
// A project pack bundles a repo's recent chats, Claude Code's memory notes for it, its CLAUDE.md / AGENTS.md and one handoff.
// The code itself travels through git.
const INSTRUCTION_FILES = ['CLAUDE.md', 'AGENTS.md', path.join('.claude', 'CLAUDE.md')];
const ccDirName = p => p.replace(/[^A-Za-z0-9]/g, '-'); // how Claude Code names ~/.claude/projects/<folder>
const memoryDir = root => path.join(HOME, '.claude', 'projects', ccDirName(root), 'memory');
const within = (p, root) => { const r = path.relative(root, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

function projectRoot(dir) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' });
  return fs.realpathSync(r.status === 0 ? r.stdout.trim() : dir);
}
function sessionCwd(c, s) {
  const key = `${s.harness}:${s.id}`;
  c.cwds ||= {};
  if (!(key in c.cwds)) { try { c.cwds[key] = common(s, true).meta.cwd || ''; } catch { c.cwds[key] = ''; } }
  return c.cwds[key];
}
function readMd(dir) {
  const out = {};
  for (const f of walk(dir, n => n.endsWith('.md'))) out[path.relative(dir, f).split(path.sep).join('/')] = fs.readFileSync(f, 'utf8');
  return out;
}
// Everything an AI needs before the chats: handoff, memory notes, instruction files.
function projectBrief(p) {
  const sec = (title, files) => Object.keys(files).length
    ? `\n\n## ${title}\n` + Object.entries(files).map(([f, t]) => `\n### ${f}\n\n${t.trim()}`).join('\n') : '';
  return `${p.handoff.trim()}${sec('Project memory (Claude Code notes)', p.memory)}${sec('Project instructions', p.instructions)}` +
    `\n\n## Chats in this pack\n${p.chats.map(ch => `- ${ch.name} (${ch.from})`).join('\n')}\n`;
}

// Which repo a folder belongs to: its git root, else the folder itself. Cached, since it runs git.
function rootOf(c, dir) {
  c.roots ||= {};
  if (!(dir in c.roots)) {
    const r = fs.existsSync(dir) ? spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }) : null;
    c.roots[dir] = r && r.status === 0 ? fs.realpathSync(r.stdout.trim()) : dir;
  }
  return c.roots[dir];
}

// Projects are the repos chats were started in. "Related" chats started somewhere else (often the parent folder)
// but mention a project's path at least RELATED_MIN times, i.e. they worked on its files.
const RELATED_MIN = 3;
function projectIndex(c) {
  const chats = named(c, Infinity), projects = new Map();
  for (const s of chats) {
    const cwd = sessionCwd(c, s);
    if (!cwd || path.resolve(cwd) === path.resolve(HOME)) continue; // a chat in your home folder isn't a project
    s.root = rootOf(c, cwd);
    if (!projects.has(s.root)) projects.set(s.root, { root: s.root, chats: [], related: [] });
    projects.get(s.root).chats.push(s);
  }
  save(c);
  // Paths appear JSON-escaped in session files (Windows backslashes doubled). Longest root first, so a mention of
  // ".../Vibe Coding/carry" counts for carry, not for "Vibe Coding".
  const roots = [...projects.keys()].sort((a, b) => b.length - a.length);
  const esc = r => JSON.stringify(r).slice(1, -1), byEsc = new Map(roots.map(r => [esc(r), r]));
  const re = roots.length && new RegExp(roots.map(r => esc(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  if (re) for (const s of chats) {
    const counts = {};
    for (const m of readSession(s, false).matchAll(re)) { const r = byEsc.get(m[0]); counts[r] = (counts[r] || 0) + 1; }
    for (const [r, n] of Object.entries(counts)) if (r !== s.root && n >= RELATED_MIN) projects.get(r).related.push({ ...s, mentions: n });
  }
  const list = [...projects.values()].map(p => ({ ...p,
    last: Math.max(...p.chats.map(s => s.mtime)),
    notes: Object.keys(readMd(memoryDir(p.root))).filter(f => f !== 'MEMORY.md').length }));
  // Name = folder name; if two repos share it, prefix the parent folder.
  const base = p => slug(path.basename(p.root).replace(/[-_]/g, ' '));
  for (const p of list) p.name = list.filter(q => base(q) === base(p)).length > 1
    ? slug(`${path.basename(path.dirname(p.root))} ${path.basename(p.root)}`.replace(/[-_]/g, ' ')) : base(p);
  return list.sort((a, b) => b.last - a.last);
}
// A project by name (from `carry projects`) or by folder; defaults to the folder you're in.
function findProject(c, ref) {
  const list = projectIndex(c);
  if (ref && !fs.existsSync(ref)) return list.find(p => p.name === ref) || die(`No project named "${ref}". Try: carry projects`);
  const root = projectRoot(ref ? path.resolve(ref) : process.cwd());
  return list.find(p => p.root === root) || { root, name: slug(path.basename(root).replace(/[-_]/g, ' ')), chats: [], related: [] };
}

function buildProject(c, proj, { handoffFile, max = 5, add = [], skip = [], related = false } = {}) {
  const root = proj.root, name = proj.name;
  let chats = [...proj.chats.slice(0, max), ...(related ? proj.related : [])];
  for (const ref of add) { const s = find(c, ref); if (!chats.some(x => x.id === s.id)) chats.push(s); }
  chats = chats.filter(s => !skip.includes(s.name)).sort((a, b) => b.mtime - a.mtime); // newest first
  if (!chats.length) die(`No chats to share for ${root}. See them with: carry projects ${name}`);
  const packs = chats.map(s => buildPack(c, s));
  const instructions = {};
  for (const f of INSTRUCTION_FILES) { const p = path.join(root, f); if (fs.existsSync(p)) instructions[f.split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); }
  const handoff = handoffFile ? fs.readFileSync(handoffFile, 'utf8') : [`# Handoff: project ${name}`, '',
    '_Auto stub. For a real summary run `/carry` in the project and ask it to share the project._', '',
    `Latest chat started with: ${firstPrompt(packs[0].pack).slice(0, 600)}`].join('\n');
  // Chats were redacted in buildPack; redact the rest the same way.
  // carry's own handoff notes (and their index lines) belong to this laptop, not to the next person.
  const memory = Object.fromEntries(Object.entries(readMd(memoryDir(root))).filter(([f]) => !f.startsWith('carry-handoff-'))
    .map(([f, t]) => [f, f === 'MEMORY.md' ? t.split('\n').filter(l => !l.includes('(carry-handoff-')).join('\n') : t]));
  const { text, count } = redact(JSON.stringify({ handoff, memory, instructions }));
  const rest = JSON.parse(text);
  return { carry: 1, kind: 'project', ...rest,
    meta: { name, kind: 'project', from: 'project', by: c.user, cwd: root, updated: new Date().toISOString(),
      redacted: count + packs.reduce((n, p) => n + p.meta.redacted, 0) },
    chats: packs.map(p => ({ name: p.meta.name, from: p.meta.from, transcript: p.transcript, pack: p.pack })) };
}

// Claude Code: memory notes go where Claude loads them, the handoff becomes a memory note too.
// Codex and others: everything goes in .carry/ and AGENTS.md points at it. Existing files are never overwritten; when a
// friend returns a project (incoming = their name), a note they changed is saved next to yours as <note>.from-<them>.md.
// Returns the folder and the sessions it wrote, so callers can name and track them.
function openProject(p, to, args, txPath, incoming) {
  const dir = path.resolve(flag(args, '--dir') || process.cwd()), name = p.meta.name;
  const latest = p.chats[0];
  if (to === 'here') return console.log(`${projectBrief(p)}\n---\n\n${latest ? latest.transcript : ''}`);
  if (to === 'chat' || !CONTINUE_TOOLS.includes(to)) return handToChat(name, projectBrief(p), latest ? latest.transcript : '');
  const wrote = [], kept = [], extraIndex = [];
  const put = (file, text) => {
    if (fs.existsSync(file)) return kept.push(file);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); wrote.push(file);
  };
  const putNote = (file, text) => {
    if (!incoming || !fs.existsSync(file) || fs.readFileSync(file, 'utf8') === text) return put(file, text);
    const alt = file.replace(/\.md$/, `.from-${slug(incoming)}.md`);
    fs.writeFileSync(alt, text); wrote.push(alt);
    extraIndex.push(`- [${path.basename(file, '.md')}, as changed by ${incoming}](${path.basename(alt)}) — their version; yours is ${path.basename(file)}`);
  };
  const from = incoming || p.meta.by, handoffNote = `carry-handoff-${name}${incoming ? `-from-${slug(incoming)}` : ''}.md`;
  for (const [f, t] of Object.entries(p.instructions)) put(path.join(dir, f), t);
  if (to === 'claude_code') {
    const mem = memoryDir(fs.realpathSync(dir));
    for (const [f, t] of Object.entries(p.memory)) if (f !== 'MEMORY.md') putNote(path.join(mem, f), t);
    fs.mkdirSync(mem, { recursive: true }); // the handoff note is carry's own file: always the latest
    fs.writeFileSync(path.join(mem, handoffNote), `---\nname: ${handoffNote.slice(0, -3)}\ndescription: ${incoming ? `What ${from} did on this project` : `Handoff from ${from} for this project`} (shared with carry)\nmetadata:\n  type: project\n---\n\n${p.handoff}`);
    wrote.push(path.join(mem, handoffNote));
    // MEMORY.md is the index Claude reads at session start: add the incoming lines it doesn't have yet.
    const idx = path.join(mem, 'MEMORY.md'), have = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
    const add = [...(p.memory['MEMORY.md'] || '').split('\n'), ...extraIndex,
      `- [${incoming ? `Update from ${from}` : `Handoff from ${from}`}](${handoffNote}) — ${incoming ? 'what they did on your project' : 'start here: where the project stands'}`]
      .filter(l => l.trim() && !have.includes(l.trim()));
    if (add.length) { fs.writeFileSync(idx, (have && !have.endsWith('\n') ? have + '\n' : have) + add.join('\n') + '\n'); wrote.push(idx); }
  } else {
    fs.mkdirSync(path.join(dir, '.carry'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.carry', incoming ? `UPDATE-from-${slug(incoming)}.md` : 'HANDOFF.md'), p.handoff);
    for (const [f, t] of Object.entries(p.memory)) putNote(path.join(dir, '.carry', 'memory', f), t);
    const agents = path.join(dir, 'AGENTS.md'), line = 'Shared project context (carry): read .carry/HANDOFF.md and .carry/memory/ before starting.';
    const cur = fs.existsSync(agents) ? fs.readFileSync(agents, 'utf8') : '';
    if (!cur.includes(line)) { fs.writeFileSync(agents, `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}\n${line}\n`); wrote.push(agents); }
  }
  console.log(`Project "${name}" ${incoming ? `update from ${incoming}` : `from ${p.meta.by}`}:`);
  wrote.forEach(f => console.log(`  wrote ${f}`));
  kept.forEach(f => console.log(`  kept your existing ${f}`));
  if (to !== 'claude_code') console.log('  tip: add .carry/ to .gitignore');
  // Oldest first, so the newest chat is the last one written and the resume command printed last.
  let status = 0;
  const opened = [];
  for (const ch of [...p.chats].reverse()) {
    const r = continueIn(ch.pack, to, dir, txPath);
    status = r.status || status;
    if (r.id) opened.push({ key: `${to}:${r.id}`, name: ch.name, baseCount: ch.pack.messages.length });
  }
  process.exitCode = status;
  return { dir, opened };
}

// ---------- friends: pair once, then an encrypted inbox per friend ----------
// Each direction (A→B, B→A) has its own key and inbox file, created by the sender's carry. Packs and inboxes are sealed with
// AES-256-GCM, so in Drive they can sit behind a plain "anyone with the link" file: carry's Drive permission only sees files
// carry itself created, so the receiver reads them by link, and only the key in the pairing code opens them.
// In folder mode they're files in the shared synced folder.
function seal(key, text) {
  const iv = crypto.randomBytes(12), ci = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  const data = Buffer.concat([ci.update(text, 'utf8'), ci.final()]);
  return JSON.stringify({ carry_sealed: 1, iv: iv.toString('base64'), tag: ci.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function unseal(key, text) {
  const e = JSON.parse(text);
  if (!e.carry_sealed) throw new Error('not a sealed carry file');
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(e.iv, 'base64'));
  d.setAuthTag(Buffer.from(e.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(e.data, 'base64')), d.final()]).toString('utf8');
}
// Create (no id) or replace (id) a file the friend can read. Returns its id: a Drive file id, or a path inside the synced folder.
async function storePut(c, name, text, id) {
  if (c.web) {
    const f = id ? await drive.upload(name, text, c.web.folderId, id) : await driveUpload(c, name, text);
    if (!id) await drive.share(f.id, [], true, '');
    return f.id;
  }
  const rel = id || `carry-friends/${name}`, file = path.join(needFolder(c), ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return rel;
}
async function storeGet(c, store, id) {
  if (store === 'drive') {
    const t = await drive.publicDownload(id);
    if (!t) throw new Error('not reachable (offline, or they removed it)');
    return t;
  }
  const file = c.folder && path.join(c.folder, ...id.split('/'));
  if (!file || !fs.existsSync(file)) throw new Error('not in your synced folder yet (is it the same shared folder, and synced?)');
  return fs.readFileSync(file, 'utf8');
}
const pairCode = (c, pair, out) => 'carry1.' + Buffer.from(JSON.stringify({ v: 1, pair, from: c.user, store: out.store, inbox: out.inbox, key: out.key })).toString('base64url');
async function makeOutbound(c, pair) {
  if (!c.web && !c.folder) die('Set up sharing first: carry setup --web');
  const out = { key: crypto.randomBytes(32).toString('base64'), store: c.web ? 'drive' : 'folder', items: [], sent: {} };
  out.inbox = await storePut(c, `inbox-${slug(c.user)}-${pair.slice(0, 8)}.json`, seal(out.key, JSON.stringify({ from: c.user, items: [] })));
  return out;
}
function findFriend(c, ref, soft) {
  const r = String(ref).toLowerCase();
  const hit = Object.entries(c.friends || {}).find(([pair, f]) => pair === ref || [f.name, f.label].some(x => x && x.toLowerCase() === r));
  return hit || (soft ? null : die(`No friend "${ref}". See: carry friends`));
}
// Put a sealed pack in the friend's view and list it in their inbox. kind: chat | project | return | return-project.
async function sendTo(c, ref, name, pack, kind, extra = {}) {
  const [pair, f] = findFriend(c, ref), k = `${kind}:${name}`;
  f.out.sent[k] = await storePut(c, `sent-${slug(c.user)}-${pair.slice(0, 8)}-${kind}-${name}.carry`, seal(f.out.key, JSON.stringify(pack)), f.out.sent[k]);
  f.out.items = [...f.out.items.filter(i => `${i.kind}:${i.name}` !== k), { name, kind, file: f.out.sent[k], at: Date.now(), ...extra }];
  await storePut(c, '', seal(f.out.key, JSON.stringify({ from: c.user, items: f.out.items })), f.out.inbox);
  save(c);
  return f.name || f.label;
}
async function readInbox(c) {
  const rows = [];
  for (const [pair, f] of Object.entries(c.friends || {})) {
    if (!f.in) continue;
    try {
      const box = JSON.parse(unseal(f.in.key, await storeGet(c, f.in.store, f.in.inbox)));
      for (const it of box.items) rows.push({ ...it, pair, from: f.name || box.from });
    } catch (e) { console.error(`  couldn't read ${f.name || f.label}'s inbox: ${e.message}`); }
  }
  return rows.sort((a, b) => b.at - a.at);
}
// Name a session we just wrote; keep the wanted name unless another chat already has it.
function setName(c, key, want) {
  c.names[key] = Object.entries(c.names).some(([k, v]) => v === want && k !== key) ? uniqueName(c, want) : want;
  return c.names[key];
}

// A borrowed chat goes back to its owner as an update. Returns who got it and how many messages were added.
async function returnChat(c, s, b, handoffFile) {
  const p = buildPack(c, s, handoffFile);
  p.meta.name = b.name;
  const added = p.pack.messages.length - b.baseCount;
  const who = await sendTo(c, b.pair, b.name, p, 'return', { added });
  b.returnedMtime = s.mtime;
  save(c);
  return { who, added };
}
// A borrowed project goes back with its tracked chats, any new chats started in that folder, and this laptop's memory notes.
async function returnProject(c, name, bp, handoffFile) {
  const all = named(c, Infinity), root = fs.realpathSync(bp.dir);
  const tracked = bp.chats.map(x => all.find(s => `${s.harness}:${s.id}` === x.key)).filter(Boolean);
  const fresh = all.filter(s => { const w = sessionCwd(c, s); return !tracked.includes(s) && s.mtime > bp.at && w && within(w, root); });
  const p = buildProject(c, { root, name, chats: [...tracked, ...fresh], related: [] }, { handoffFile, max: Infinity });
  if (!handoffFile) p.handoff = `# ${c.user}'s work on ${name}\n\n${p.chats.length} chat(s) continued or started on ${c.user}'s laptop: ${p.chats.map(ch => ch.name).join(', ')}.`;
  const who = await sendTo(c, bp.pair, name, p, 'return-project', { chats: p.chats.length });
  bp.returnedAt = Date.now();
  save(c);
  return { who, chats: p.chats.length };
}

// ---------- commands ----------
const CONTINUE_TOOLS = ['claude_code', 'codex', 'opencode', 'cursor', 'pi', 'antigravity']; // txcript can write these natively
const cmds = {
  async setup(args) {
    const c = load();
    c.user = flag(args, '--as') || c.user || os.userInfo().username;
    const friends = flag(args, '--with');
    if (friends) c.friends = friends.split(',').map(e => e.trim()).filter(Boolean);
    if (args.includes('--web')) {
      await drive.signIn();
      c.web = { folderId: c.web?.folderId || await drive.makeFolder('carry') };
      delete c.folder;
      save(c);
      return console.log(`Connected to Google Drive (folder "carry").\nYou appear as: ${c.user}${c.friends ? `\nNew shares go to: ${c.friends.join(', ')}` : ''}`);
    }
    let folder = args.find(a => !a.startsWith('--') && a !== flag(args, '--as') && a !== friends);
    if (!folder) {
      const gd = driveFolder();
      if (!gd) die('Google Drive for desktop not found. Use web Drive instead: carry setup --web\nOr pass any synced folder: carry setup ~/Dropbox/carry');
      folder = path.join(gd, 'carry');
    }
    c.folder = path.resolve(folder.replace(/^~(?=$|[\\/])/, HOME));
    delete c.web;
    fs.mkdirSync(c.folder, { recursive: true });
    save(c);
    console.log(`Share folder: ${c.folder}\nYou appear as: ${c.user}`);
  },
  mcp() { require('./mcp').serve(); },
  update() {
    if (fs.existsSync(path.join(__dirname, '.git'))) return console.log(`This copy of carry is a git checkout. Update it with:\n  git -C "${__dirname}" pull\n  npm install`);
    const r = spawnSync('npm', ['install', '-g', `${PKG.name}@latest`], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) die(`Update failed.${process.platform === 'linux' ? ` If npm needs root here: sudo npm install -g ${PKG.name}@latest` : ''}`);
    try { fs.rmSync(UPDATE_FILE); } catch {}
  },
  // Versions, where txcript is (fetching it if missing) and how sharing is set up.
  async doctor() {
    const c = load();
    console.log(`carry ${PKG.version} · node ${process.version} · ${process.platform}-${process.arch}`);
    console.log(`txcript: ${await txcriptPath()}`);
    console.log(`sharing: ${c.web ? `Google Drive (web) as ${c.user}` : c.folder ? `synced folder ${c.folder} as ${c.user}` : 'not set up (run: carry setup --web)'}`);
  },
  version() { console.log(PKG.version); },
  '--version'() { console.log(PKG.version); },
  async '__check-update'() { await checkUpdate(); },
  // Copies the /carry skill into every AI tool found on this computer.
  'install-skill'() {
    const src = path.join(__dirname, 'skills', 'carry');
    const tools = { 'Claude Code': '.claude', Codex: '.codex', 'shared agents folder': '.agents' };
    let n = 0;
    for (const [tool, dir] of Object.entries(tools)) {
      if (!fs.existsSync(path.join(HOME, dir))) continue;
      const dest = path.join(HOME, dir, 'skills', 'carry');
      fs.cpSync(src, dest, { recursive: true });
      console.log(`/carry added to ${tool} (${dest})`);
      n++;
    }
    if (!n) console.log('No AI tools found (looked for ~/.claude, ~/.codex, ~/.agents). Install one, then run: carry install-skill');
  },
  // `carry projects` lists them; `carry projects <name>` shows the chats in one, to pick from.
  projects(args) {
    const c = load(), list = projectIndex(c), ref = args.find(a => !a.startsWith('-'));
    const homes = [HOME, fs.realpathSync(HOME)]; // macOS: /var/... vs /private/var/...
    const home = p => { const h = homes.find(x => p === x || p.startsWith(x + path.sep)); return h ? '~' + p.slice(h.length) : p; };
    if (!ref) {
      if (!list.length) return console.log('No projects yet. Start a Claude Code or Codex chat inside a project folder.');
      for (const p of list.slice(0, Number(flag(args, '-n')) || 15)) {
        console.log(`${p.name.padEnd(30)} ${String(p.chats.length).padStart(2)} chat(s)${p.related.length ? ` +${p.related.length} related` : ''}` +
          `  ${p.notes} note(s)  ${ago(p.last).padEnd(8)} ${home(p.root)}`);
      }
      return console.log('\nDetails: carry projects <name>   Share: carry share --project <name>');
    }
    const p = list.find(x => x.name === ref) || die(`No project named "${ref}". Try: carry projects`);
    console.log(`${p.name}  ${home(p.root)}  ·  ${p.notes} Claude memory note(s)\n\nChats started here (newest first; the first 5 are shared by default):`);
    p.chats.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.name.padEnd(36)} ${s.harness.padEnd(12)} ${ago(s.mtime)}`));
    if (p.related.length) {
      console.log('\nRelated chats (started elsewhere, worked on this project\'s files):');
      p.related.forEach(s => console.log(`      ${s.name.padEnd(36)} ${s.harness.padEnd(12)} ${ago(s.mtime).padEnd(8)} ${s.mentions} mentions`));
    }
    console.log(`\nShare: carry share --project ${p.name} [--chats N] [--add <chat>,...] [--skip <chat>,...] [--related]`);
  },
  list(args) {
    const c = load();
    const rows = named(c, Number(flag(args, '-n')) || 20);
    for (const s of rows) console.log(`${s.name.padEnd(36)} ${s.harness.padEnd(12)} ${ago(s.mtime).padEnd(9)} ${c.shared[s.name] ? 'shared' : ''}`);
  },
  name([ref, ...words]) {
    if (!ref || !words.length) die('Usage: carry name <chat> <new name>');
    const c = load(), s = find(c, ref), n = slug(words.join(' ').replace(/-/g, ' '));
    if (Object.values(c.names).includes(n)) die(`"${n}" is already used`);
    c.names[`${s.harness}:${s.id}`] = n;
    if (c.shared[s.name]) { c.shared[n] = c.shared[s.name]; delete c.shared[s.name]; }
    save(c);
    console.log(`${s.name} → ${n}`);
  },
  async share(args) {
    const list = v => (flag(args, v) || '').split(',').map(x => x.trim()).filter(Boolean);
    const emails = list('--with'), friends = list('--to'), autoReturn = args.includes('--auto-return');
    if (args.includes('--project')) {
      const c = load(), arg = flag(args, '--project');
      const proj = findProject(c, arg && !arg.startsWith('--') ? arg : null);
      const p = buildProject(c, proj, { handoffFile: flag(args, '--handoff'), max: Number(flag(args, '--chats')) || 5,
        add: list('--add'), skip: list('--skip'), related: args.includes('--related') });
      if (friends.length) { // to paired friends: their carry inbox
        for (const fr of friends) console.log(`Sent project "${p.meta.name}" (${p.chats.length} chat(s)) to ${await sendTo(c, fr, p.meta.name, p, 'project', { autoReturn })}'s inbox.`);
        c.shared[p.meta.name] = { ...(c.shared[p.meta.name] || {}), project: proj.root };
        return save(c);
      }
      const { prev, where } = await publish(c, p.meta.name, p, { emails, link: args.includes('--link') });
      c.shared[p.meta.name] = { ...prev, project: proj.root, where };
      save(c);
      const notes = Object.keys(p.memory).filter(f => f !== 'MEMORY.md').length;
      console.log(`Shared project "${p.meta.name}" (${p.chats.length} chat(s): ${p.chats.map(ch => ch.name).join(', ')}; ` +
        `${notes} memory note(s), ${Object.keys(p.instructions).length} instruction file(s)) → ${where}` +
        `${p.meta.redacted ? `  (${p.meta.redacted} secret(s) redacted)` : ''}`);
      const left = proj.related.filter(r => !p.chats.some(ch => ch.name === r.name));
      if (left.length) console.log(`  ${left.length} related chat(s) also worked on it: ${left.map(r => r.name).join(', ')}\n  Include with --add <name> or --related`);
      return;
    }
    const c = load(), s = find(c, await pickArg(args, 'chat', named(c, 9).map(x => `${x.name.padEnd(36)} ${x.harness.padEnd(12)} ${ago(x.mtime)}`),
      'Usage: carry share <chat> | --project [name] [--to friend] [--with emails] [--link] [--handoff file.md]'));
    if (friends.length) {
      const p = buildPack(c, s, flag(args, '--handoff'));
      for (const fr of friends) console.log(`Sent "${s.name}" to ${await sendTo(c, fr, s.name, p, 'chat', { autoReturn })}'s inbox.${p.meta.redacted ? `  (${p.meta.redacted} secret(s) redacted)` : ''}`);
      c.shared[s.name] = { ...(c.shared[s.name] || {}), harness: s.harness, id: s.id, mtime: s.mtime, count: p.pack.messages.length };
      return save(c);
    }
    const { where, count } = await share(c, s, { handoffFile: flag(args, '--handoff'), emails, link: args.includes('--link') });
    console.log(`Shared "${s.name}" → ${where}${count ? `  (${count} secret(s) redacted)` : ''}`);
  },
  // Share just a summary, e.g. from the Claude app or ChatGPT, whose chats live on their servers.
  async note(args) {
    const usage = 'Usage: carry note "<name>" --handoff summary.md [--with emails] [--link]';
    if (!args[0] || args[0].startsWith('--')) die(usage);
    const c = load(), name = slug(args[0].replace(/-/g, ' ')), file = flag(args, '--handoff') || die(usage);
    const { text, count } = redact(fs.readFileSync(file, 'utf8'));
    const p = { carry: 1, meta: { name, from: 'chat app', by: c.user, cwd: '', updated: new Date().toISOString(), redacted: count },
      handoff: text, transcript: '', pack: null };
    const emails = (flag(args, '--with') || '').split(',').map(e => e.trim()).filter(Boolean);
    const { prev, where } = await publish(c, name, p, { emails, link: args.includes('--link') });
    c.shared[name] = { ...prev, note: true, where };
    save(c);
    console.log(`Shared summary "${name}" → ${where}${count ? `  (${count} secret(s) redacted)` : ''}`);
  },
  async sync() {
    const c = load(), all = named(c, Infinity);
    for (const s of all) {
      const prev = c.shared[s.name];
      if (prev?.where && s.mtime > prev.mtime) { await share(c, s); console.log(`updated ${s.name}`); }
    }
    // Chats and projects borrowed with --auto-return go back to their owner whenever they changed here.
    for (const [key, b] of Object.entries(c.borrowed || {})) {
      const s = b.autoReturn && all.find(x => `${x.harness}:${x.id}` === key);
      if (s && s.mtime > (b.returnedMtime || b.at)) { const r = await returnChat(c, s, b); console.log(`returned ${b.name} to ${r.who} (+${r.added})`); }
    }
    for (const [name, bp] of Object.entries(c.borrowedProjects || {})) {
      if (!bp.autoReturn) continue;
      const since = bp.returnedAt || bp.at, root = fs.existsSync(bp.dir) && fs.realpathSync(bp.dir);
      const changed = root && all.some(s => s.mtime > since && (bp.chats.some(x => x.key === `${s.harness}:${s.id}`) || (w => w && within(w, root))(sessionCwd(c, s))));
      if (changed) { const r = await returnProject(c, name, bp); console.log(`returned project ${name} to ${r.who}`); }
    }
  },
  // Optional: run `carry sync` when a Claude Code session ends, so --auto-return shares go back on their own.
  'install-hook'() {
    const file = path.join(HOME, '.claude', 'settings.json');
    let s = {}; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file)) die(`Couldn't read ${file}: ${e.message}`); }
    const command = `"${process.execPath}" "${__filename}" sync`;
    s.hooks ||= {}; s.hooks.SessionEnd ||= [];
    if (s.hooks.SessionEnd.some(e => (e.hooks || []).some(h => h.command === command))) return console.log('Already installed.');
    s.hooks.SessionEnd.push({ hooks: [{ type: 'command', command, timeout: 60 }] });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
    console.log(`Added a SessionEnd hook to ${file}: carry sync runs when a Claude Code session ends.`);
  },
  // Tab completion for zsh: carry completion zsh >> ~/.zshrc
  completion([shell]) {
    if (shell !== 'zsh') die('Usage: carry completion zsh >> ~/.zshrc   (then open a new terminal)');
    console.log(ZSH_COMPLETION);
  },
  __names([kind]) { // used by the completion script
    const c = load();
    const out = kind === 'chats' ? named(c, 30).map(s => s.name) : kind === 'packs' ? packNames(c)
      : kind === 'projects' ? projectIndex(c).map(p => p.name) : kind === 'friends' ? Object.values(c.friends || {}).map(f => f.name || f.label) : [];
    console.log(out.join('\n'));
  },
  packs() {
    const c = load();
    if (c.web) { // drive.file can't list other people's files, so web mode shows your own shares; friends' arrive as emailed links
      for (const [n, s] of Object.entries(c.shared)) if (s.fileId) console.log(`${n.padEnd(36)} ${s.where}`);
      return;
    }
    const dir = needFolder(c);
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.carry'))) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).meta;
        console.log(`${m.name.padEnd(36)} by ${String(m.by).padEnd(14)} from ${m.from.padEnd(12)} ${ago(Date.parse(m.updated))}`);
      } catch {}
    }
  },
  async open(args) {
    const c = load(), ref = await pickArg(args, 'pack', packNames(c).reverse().slice(0, 9),
      'Usage: carry open <inbox number | pack name | file.carry | Drive link> [--to claude_code|codex|chat]');
    const to = flag(args, '--to') || 'claude_code', tool = CONTINUE_TOOLS.includes(to), noResume = args.includes('--no-resume');
    let p, item;
    if (/^\d+$/.test(ref)) { // a number from `carry inbox`
      item = (c.lastInbox || [])[Number(ref) - 1] || die('No such item. Run: carry inbox');
      const f = c.friends[item.pair];
      p = JSON.parse(unseal(f.in.key, await storeGet(c, f.in.store, item.file)));
      (c.seen ||= {})[`${item.pair}:${item.kind}:${item.name}`] = item.at;
    } else p = await readPack(c, ref);
    const name = p.meta.name, cwd = process.cwd();

    if (p.kind === 'project') {
      const back = item?.kind === 'return-project';
      const r = openProject(p, to, args, tool ? await txcriptPath() : null, back ? item.from : null);
      if (r) {
        r.opened.forEach(o => setName(c, o.key, back ? `${o.name}-from-${slug(item.from)}` : o.name));
        if (item && !back) (c.borrowedProjects ||= {})[name] = { pair: item.pair, owner: item.from, dir: r.dir, chats: r.opened, at: Date.now(), autoReturn: !!item.autoReturn };
        if (item && !back) console.log(`\nWhen you're done here: carry return --project ${name}  (sends it back to ${item.from})`);
      }
      return save(c);
    }
    if (to === 'here') { save(c); return console.log(`${p.handoff}\n\n---\n\n${p.transcript}`); } // for an AI reading stdout (MCP, skills)
    if (!p.pack && to !== 'chat') die(`"${name}" is a summary shared from a chat app, not a full chat. Open it with --to chat or --to here.`);
    if (!tool) { save(c); return handToChat(name, p.handoff, p.transcript); }

    // A friend sent back a chat you shared: continue from their latest, unless you also kept going here.
    let mine, mineNow;
    if (item?.kind === 'return') {
      mine = c.shared[name];
      const s = mine?.id && sessions().find(x => x.harness === mine.harness && x.id === mine.id);
      if (s) try { mineNow = common(s, false).messages.length; } catch {}
    }
    const r = continueIn(p.pack, to, cwd, await txcriptPath());
    process.exitCode = r.status;
    if (r.id) {
      const key = `${to}:${r.id}`;
      if (item?.kind === 'return') {
        if (mine?.count != null && mineNow > mine.count) {
          const n = setName(c, key, `${name}-from-${slug(item.from)}`);
          console.log(`\nYou also continued "${name}" here (${mineNow - mine.count} new message(s)) while ${item.from} added ${item.added}.` +
            `\nOpened their version as "${n}". Yours is untouched.`);
        } else {
          if (mine?.id) c.names[`${mine.harness}:${mine.id}`] = uniqueName(c, `${name}-before-${slug(item.from)}`);
          setName(c, key, name);
          c.shared[name] = { ...(c.shared[name] || {}), harness: to, id: r.id, mtime: Date.now(), count: p.pack.messages.length };
          console.log(`\n"${name}" now includes ${item.from}'s work (+${item.added} message(s)).${mine?.id ? ` Your previous copy is "${c.names[`${mine.harness}:${mine.id}`]}".` : ''}`);
        }
      } else if (item) { // borrowed: remember whose it is, so `carry return` can send it back
        setName(c, key, name);
        (c.borrowed ||= {})[key] = { name, pair: item.pair, owner: item.from, baseCount: p.pack.messages.length, at: Date.now(), autoReturn: !!item.autoReturn };
        console.log(`\nWhen you're done here: carry return ${c.names[key]}  (sends it back to ${item.from})`);
      }
    }
    save(c);
    if (!noResume) launch(r.cmd, cwd);
  },
  // Pair once: `carry friend add <email or name>` prints a code for them; `carry friend add <code>` accepts one (and prints yours back).
  async friend([sub, ...rest]) {
    const c = load(), arg = rest.join(' ').trim();
    c.friends ||= {};
    if (sub === 'remove') {
      const [pair, f] = findFriend(c, arg || die('Usage: carry friend remove <name>'));
      delete c.friends[pair];
      save(c);
      return console.log(`Removed ${f.name || f.label}. They can't read anything you send from now on.`);
    }
    if (sub !== 'add' || !arg) die('Usage: carry friend add <their email or name>   or   carry friend add <their pairing code>');
    if (arg.startsWith('carry1.')) {
      let p; try { p = JSON.parse(Buffer.from(arg.slice(7), 'base64url').toString('utf8')); } catch { die('That pairing code looks broken. Copy all of it again.'); }
      if (p.store === 'folder' && !c.folder) die(`${p.from} uses a shared synced folder. Run carry setup <that same folder> first.`);
      const f = c.friends[p.pair] ||= { label: p.from };
      f.name = p.from;
      f.in = { store: p.store, inbox: p.inbox, key: p.key };
      let reply = null;
      if (!f.out) { f.out = await makeOutbound(c, p.pair); reply = pairCode(c, p.pair, f.out); }
      save(c);
      console.log(`Paired with ${p.from}. What they send shows up in: carry inbox`);
      if (reply) console.log(`\nSo ${p.from} can receive from you too (and get their chats back), send them this code once:\n\n${reply}\n\nThey run: carry friend add <code>`);
      return;
    }
    if (findFriend(c, arg, true)) die(`You already added ${arg}. See: carry friends`);
    const pair = crypto.randomUUID(), out = await makeOutbound(c, pair);
    c.friends[pair] = { label: arg, out };
    save(c);
    console.log(`Send ${arg} this pairing code once (any chat app or email):\n\n${pairCode(c, pair, out)}\n\n` +
      `They run: carry friend add <code>. It prints a code for you back; run carry friend add <their code> so you can receive from them.`);
  },
  friends() {
    const c = load(), list = Object.values(c.friends || {});
    if (!list.length) return console.log('No friends yet. Add one: carry friend add <their email>');
    for (const f of list) console.log(`${(f.name || f.label).padEnd(24)} ${f.out ? 'you send ✓' : 'you send ✗'}   ${f.in ? 'you receive ✓' : 'you receive ✗ (waiting for their code)'}   sent ${f.out?.items.length || 0}`);
  },
  async inbox() {
    const c = load(), rows = await readInbox(c);
    c.lastInbox = rows;
    save(c);
    if (!rows.length) return console.log(Object.values(c.friends || {}).some(f => f.in) ? 'Nothing here yet.' : 'No friends to receive from yet. Pair with: carry friend add <their code>');
    rows.forEach((it, i) => {
      const what = it.kind === 'return' ? `UPDATED by ${it.from} (+${it.added} message(s))` : it.kind === 'return-project' ? `UPDATED project by ${it.from} (${it.chats} chat(s))`
        : `${it.kind} from ${it.from}`;
      const isNew = (c.seen || {})[`${it.pair}:${it.kind}:${it.name}`] !== it.at;
      console.log(`${String(i + 1).padStart(3)}. ${it.name.padEnd(34)} ${what.padEnd(40)} ${ago(it.at).padEnd(8)}${isNew ? ' NEW' : ''}`);
    });
    console.log('\nOpen one: carry open <number> --to claude_code|codex');
  },
  // Send a chat (or project) you opened from a friend back to them, with everything done here.
  async return(args) {
    const c = load();
    if (args.includes('--project')) {
      const name = flag(args, '--project') || die('Usage: carry return --project <name>');
      const bp = (c.borrowedProjects || {})[name] || die(`"${name}" wasn't opened from a friend's share on this laptop. See: carry inbox`);
      const r = await returnProject(c, name, bp, flag(args, '--handoff'));
      return console.log(`Returned project "${name}" to ${r.who} (${r.chats} chat(s) and this laptop's memory notes). Remind them to pull the code.`);
    }
    const s = find(c, args[0] || die('Usage: carry return <chat> | --project <name>'));
    const b = (c.borrowed || {})[`${s.harness}:${s.id}`] || die(`"${s.name}" wasn't opened from a friend's share, so there's no one to return it to. To send it to someone: carry share ${s.name} --to <friend>`);
    const r = await returnChat(c, s, b, flag(args, '--handoff'));
    console.log(`Returned "${b.name}" to ${r.who} (+${r.added} message(s)).`);
  },
};

// Chat apps (Claude app, ChatGPT, Antigravity app): write the files to attach and copy a prompt.
function handToChat(name, handoff, transcript) {
  const dir = path.join(path.dirname(CONF), 'opened', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'handoff.md'), handoff);
  fs.writeFileSync(path.join(dir, 'transcript.md'), transcript);
  const prompt = `I'm continuing work started in another AI chat. Read the attached handoff.md first (and transcript.md if you need detail), then tell me where we left off and continue.`;
  const copied = copyText(prompt);
  reveal(path.join(dir, 'handoff.md'));
  console.log(copied
    ? `Prompt copied. Attach ${path.join(dir, 'handoff.md')} (and transcript.md) to your chat and paste.`
    : `Attach ${path.join(dir, 'handoff.md')} (and transcript.md) to your chat with this prompt:\n\n${prompt}`);
}

// Write a chat into a coding tool as a real session (new id, this laptop's folder). Returns the new session's id and the
// command that resumes it; callers record what they need first, then launch() it, so nothing is lost if the tool runs long.
function continueIn(pack, to, cwd, txPath) {
  const doc = { ...pack, id: crypto.randomUUID(), cwd };
  const tmp = path.join(os.tmpdir(), `carry-${doc.id}.json`);
  fs.writeFileSync(tmp, JSON.stringify(doc));
  const r = spawnSync(txPath, ['continue', tmp, '--with', to, '--no-resume'], { cwd, encoding: 'utf8' });
  fs.rmSync(tmp, { force: true });
  if (r.error) die(`Couldn't run txcript at ${txPath}: ${r.error.message}`);
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  const cmd = ((r.stdout || '').match(/resume with: (.+)$/m) || [])[1]?.trim();
  return { status: r.status, id: cmd && cmd.split(/\s+/).pop(), cmd };
}
function launch(cmd, cwd) { if (cmd) spawnSync(cmd, { cwd, stdio: 'inherit', shell: true }); }

function flag(args, f) { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; }
function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  return s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
}

const ZSH_COMPLETION = `# carry tab completion (zsh)
(( $+functions[compdef] )) || { autoload -Uz compinit && compinit }
_carry() {
  if (( CURRENT == 2 )); then
    compadd setup install-skill list name share projects note friend friends inbox return install-hook sync packs open mcp update doctor completion
    return
  fi
  case $words[CURRENT-1] in
    --to) if [[ $words[2] == open ]]; then compadd claude_code codex opencode cursor pi chat here
          else compadd -- \${(f)"$(carry __names friends 2>/dev/null)"}; fi; return ;;
    --project) compadd -- \${(f)"$(carry __names projects 2>/dev/null)"}; return ;;
    --handoff|--dir) _files; return ;;
  esac
  if [[ $words[CURRENT] == -* ]]; then
    compadd -- --to --with --link --handoff --project --chats --add --skip --related --dir --auto-return --no-resume --web --as
    return
  fi
  case $words[2] in
    share|name|return) (( CURRENT == 3 )) && compadd -- \${(f)"$(carry __names chats 2>/dev/null)"} ;;
    open) (( CURRENT == 3 )) && { compadd -- \${(f)"$(carry __names packs 2>/dev/null)"}; _files -g '*.carry' } ;;
    projects) compadd -- \${(f)"$(carry __names projects 2>/dev/null)"} ;;
    friend) (( CURRENT == 3 )) && compadd add remove ;;
    completion) compadd zsh ;;
    setup) _files -/ ;;
  esac
}
compdef _carry carry
`;

const USAGE = `carry setup --web [--as name] [--with emails]   connect Google Drive in the browser
carry setup [folder] [--as name]                 or use a synced folder (Drive for desktop, Dropbox, iCloud)
carry install-skill                              add /carry to Claude Code, Codex and ~/.agents
carry list | name <chat> <new name>              this laptop's chats, by name
carry share <chat> [--handoff f] [--with emails] [--link]
carry projects [name]                            your projects (repos) and the chats in each
carry share --project [name|dir] [--chats 5] [--add a,b] [--skip c] [--related] [--handoff f] [--with emails]
carry note "<name>" --handoff f [--with emails] [--link]   share just a summary (from a chat app)
carry friend add <email|code> | friend remove <name> | friends   pair once with a friend
carry share <chat> --to <friend>[,friend] [--auto-return]        into their inbox (also --project <name> --to ...)
carry inbox                                      what friends sent you; open one: carry open <number> --to claude_code|codex
carry return <chat> | return --project <name>    send a chat/project you opened from a friend back, with your work
carry install-hook                               run carry sync after each Claude Code session (for --auto-return)
carry sync | packs
carry open <name | file.carry | Drive link> [--to claude_code|codex|opencode|cursor|pi|chat|here] [--dir project folder]
carry mcp                                        run as an MCP server (Claude Desktop, Codex, ChatGPT, Cursor)
carry completion zsh >> ~/.zshrc                 Tab-complete commands and chat names (new terminal after)
carry update | doctor | --version`;

module.exports = { redact, slug, cleanPrompt, readPack, findTxcript };
// ---------- updates ----------
// Shows a cached "new version" line on stderr; refreshes the cache at most once a day in a detached child, so commands never wait.
const PKG = require('./package.json');
const UPDATE_FILE = path.join(HOME, '.carry', 'update.json');
function newer(a, b) { // is version a newer than b
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
async function checkUpdate() {
  try {
    const r = await fetch(`https://registry.npmjs.org/${PKG.name.replace('/', '%2f')}`, { headers: { Accept: 'application/vnd.npm.install-v1+json' } });
    const latest = r.ok ? (await r.json())['dist-tags']?.latest : null;
    fs.mkdirSync(path.dirname(UPDATE_FILE), { recursive: true });
    fs.writeFileSync(UPDATE_FILE, JSON.stringify({ checked: Date.now(), latest }));
  } catch {}
}
function updateNotice() {
  let u = {}; try { u = JSON.parse(fs.readFileSync(UPDATE_FILE, 'utf8')); } catch {}
  if (u.latest && newer(u.latest, PKG.version)) console.error(`\ncarry ${u.latest} is out (you have ${PKG.version}). Update: carry update`);
  if (!u.checked || Date.now() - u.checked > 864e5) {
    try { spawn(process.execPath, [__filename, '__check-update'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch {}
  }
}

module.exports.newer = newer;
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  // No notice inside MCP (stdout is the protocol), CI, or when opted out with CARRY_NO_UPDATE_CHECK=1.
  const quiet = ['mcp', 'update', '__check-update', '__names', 'completion', 'version', '--version'].includes(cmd) || process.env.CI || process.env.CARRY_NO_UPDATE_CHECK;
  // Unknown command: help on stderr + exit 1, so `carry <typo> >> file` never writes the help text into a file.
  Promise.resolve((cmds[cmd] || (() => cmd ? die(`Unknown command "${cmd}".\n\n${USAGE}`) : console.log(USAGE)))(args))
    .then(() => { if (!quiet) updateNotice(); })
    .catch(e => die(e.message));
}
