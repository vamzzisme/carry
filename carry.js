#!/usr/bin/env node
// carry: share AI chats by name through a folder you own. Wraps txcript (https://github.com/skillsynchq/txcript).
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const tx = require('txcript');
const drive = require('./drive');
const { openTarget, reveal, copyText, driveFolder } = require('./system');

const HOME = os.homedir();
const CONF = path.join(HOME, '.carry', 'config.json');
const HEAD_BYTES = 256 * 1024; // enough of a session to find its first prompt
// txcript: $TXCRIPT, else the copy `npm install` put in ./bin, else whatever is on PATH.
const BUNDLED = path.join(__dirname, 'bin', process.platform === 'win32' ? 'txcript.exe' : 'txcript');
const TXCRIPT = process.env.TXCRIPT || (fs.existsSync(BUNDLED) ? BUNDLED : 'txcript');

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

// Synced-folder mode writes the file and lets Drive/Dropbox/iCloud upload it; web mode uploads through the Drive API.
async function publish(c, name, p, { emails = [], link = false } = {}) {
  const body = JSON.stringify(p), prev = c.shared[name] || {};
  let where;
  if (c.web) {
    const f = await drive.upload(`${name}.carry`, body, c.web.folderId, prev.fileId);
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
  c.shared[s.name] = { ...prev, harness: s.harness, id: s.id, mtime: s.mtime, where };
  save(c);
  return { where, count: p.meta.redacted };
}

// Read a pack from a Drive link, a .carry file, or a name in the synced folder.
async function readPack(c, ref) {
  const id = drive.fileIdFrom(ref);
  let text;
  if (id) text = await drive.publicDownload(id) || await viaBrowser(ref);
  else if (ref.endsWith('.carry') && fs.existsSync(ref)) text = fs.readFileSync(ref, 'utf8');
  else {
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

function buildProject(c, root, { handoffFile, max = 5 } = {}) {
  const chats = named(c, Infinity).filter(s => { const w = sessionCwd(c, s); return w && within(w, root); }).slice(0, max);
  save(c);
  if (!chats.length) die(`No Claude Code or Codex chats found for ${root}. Run this inside the project folder.`);
  const packs = chats.map(s => buildPack(c, s));
  const instructions = {};
  for (const f of INSTRUCTION_FILES) { const p = path.join(root, f); if (fs.existsSync(p)) instructions[f.split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); }
  const name = slug(path.basename(root).replace(/[-_]/g, ' '));
  const handoff = handoffFile ? fs.readFileSync(handoffFile, 'utf8') : [`# Handoff: project ${name}`, '',
    '_Auto stub. For a real summary run `/carry` in the project and ask it to share the project._', '',
    `Latest chat started with: ${firstPrompt(packs[0].pack).slice(0, 600)}`].join('\n');
  // Chats were redacted in buildPack; redact the rest the same way.
  const { text, count } = redact(JSON.stringify({ handoff, memory: readMd(memoryDir(root)), instructions }));
  const rest = JSON.parse(text);
  return { carry: 1, kind: 'project', ...rest,
    meta: { name, kind: 'project', from: 'project', by: c.user, cwd: root, updated: new Date().toISOString(),
      redacted: count + packs.reduce((n, p) => n + p.meta.redacted, 0) },
    chats: packs.map(p => ({ name: p.meta.name, from: p.meta.from, transcript: p.transcript, pack: p.pack })) };
}

// Claude Code: memory notes go where Claude loads them, the handoff becomes a memory note too.
// Codex and others: everything goes in .carry/ and AGENTS.md points at it. Existing files are never overwritten.
function openProject(p, to, args) {
  const dir = path.resolve(flag(args, '--dir') || process.cwd()), name = p.meta.name;
  const latest = p.chats[0];
  if (to === 'here') return console.log(`${projectBrief(p)}\n---\n\n${latest ? latest.transcript : ''}`);
  if (to === 'chat' || !CONTINUE_TOOLS.includes(to)) return handToChat(name, projectBrief(p), latest ? latest.transcript : '');
  const wrote = [], kept = [];
  const put = (file, text) => {
    if (fs.existsSync(file)) return kept.push(file);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); wrote.push(file);
  };
  for (const [f, t] of Object.entries(p.instructions)) put(path.join(dir, f), t);
  if (to === 'claude_code') {
    const mem = memoryDir(fs.realpathSync(dir)), handoffNote = `carry-handoff-${name}.md`;
    for (const [f, t] of Object.entries(p.memory)) if (f !== 'MEMORY.md') put(path.join(mem, f), t);
    put(path.join(mem, handoffNote), `---\nname: carry-handoff-${name}\ndescription: Handoff from ${p.meta.by} for this project (shared with carry)\nmetadata:\n  type: project\n---\n\n${p.handoff}`);
    // MEMORY.md is the index Claude reads at session start: add the incoming lines it doesn't have yet.
    const idx = path.join(mem, 'MEMORY.md'), have = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
    const add = [...(p.memory['MEMORY.md'] || '').split('\n'), `- [Handoff from ${p.meta.by}](${handoffNote}) — start here: where the project stands`]
      .filter(l => l.trim() && !have.includes(l.trim()));
    if (add.length) { fs.mkdirSync(mem, { recursive: true }); fs.writeFileSync(idx, (have && !have.endsWith('\n') ? have + '\n' : have) + add.join('\n') + '\n'); wrote.push(idx); }
  } else {
    put(path.join(dir, '.carry', 'HANDOFF.md'), p.handoff);
    for (const [f, t] of Object.entries(p.memory)) put(path.join(dir, '.carry', 'memory', f), t);
    const agents = path.join(dir, 'AGENTS.md'), line = 'Shared project context (carry): read .carry/HANDOFF.md and .carry/memory/ before starting.';
    const cur = fs.existsSync(agents) ? fs.readFileSync(agents, 'utf8') : '';
    if (!cur.includes(line)) { fs.writeFileSync(agents, `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}\n${line}\n`); wrote.push(agents); }
  }
  console.log(`Project "${name}" from ${p.meta.by}:`);
  wrote.forEach(f => console.log(`  wrote ${f}`));
  kept.forEach(f => console.log(`  kept your existing ${f}`));
  if (to !== 'claude_code') console.log('  tip: add .carry/ to .gitignore');
  // Oldest first, so the newest chat is the last one written and the resume command printed last.
  let status = 0;
  for (const ch of [...p.chats].reverse()) status = continueIn(ch.pack, to, dir, true) || status;
  process.exitCode = status;
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
    const emails = (flag(args, '--with') || '').split(',').map(e => e.trim()).filter(Boolean);
    if (args.includes('--project')) {
      const c = load(), arg = flag(args, '--project');
      const root = projectRoot(arg && !arg.startsWith('--') ? path.resolve(arg) : process.cwd());
      const p = buildProject(c, root, { handoffFile: flag(args, '--handoff'), max: Number(flag(args, '--chats')) || 5 });
      const { prev, where } = await publish(c, p.meta.name, p, { emails, link: args.includes('--link') });
      c.shared[p.meta.name] = { ...prev, project: root, where };
      save(c);
      return console.log(`Shared project "${p.meta.name}" (${p.chats.length} chats, ${Object.keys(p.memory).length} memory notes, ` +
        `${Object.keys(p.instructions).length} instruction files) → ${where}${p.meta.redacted ? `  (${p.meta.redacted} secret(s) redacted)` : ''}`);
    }
    const c = load(), s = find(c, args[0] || die('Usage: carry share <chat> | --project [dir] [--handoff file.md] [--with a@x.com,b@y.com] [--link]'));
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
    const c = load();
    for (const s of named(c, Infinity)) {
      const prev = c.shared[s.name];
      if (prev && s.mtime > prev.mtime) { await share(c, s); console.log(`updated ${s.name}`); }
    }
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
    const c = load(), ref = args[0] || die('Usage: carry open <pack name | file.carry | Drive link> [--to claude_code|codex|chat]');
    const p = await readPack(c, ref), name = p.meta.name;
    const to = flag(args, '--to') || 'claude_code';
    if (p.kind === 'project') return openProject(p, to, args);
    if (to === 'here') return console.log(`${p.handoff}\n\n---\n\n${p.transcript}`); // for an AI reading stdout (MCP, skills)
    if (!p.pack && to !== 'chat') die(`"${name}" is a summary shared from a chat app, not a full chat. Open it with --to chat or --to here.`);
    if (to === 'chat' || !CONTINUE_TOOLS.includes(to)) return handToChat(name, p.handoff, p.transcript);
    process.exitCode = continueIn(p.pack, to, process.cwd(), args.includes('--no-resume'));
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

// Write a chat into a coding tool as a real session. New id so it never clashes with the original; cwd = this laptop's folder.
function continueIn(pack, to, cwd, noResume) {
  const doc = { ...pack, id: crypto.randomUUID(), cwd };
  const tmp = path.join(os.tmpdir(), `carry-${doc.id}.json`);
  fs.writeFileSync(tmp, JSON.stringify(doc));
  const r = spawnSync(TXCRIPT, ['continue', tmp, '--with', to, ...(noResume ? ['--no-resume'] : [])], { stdio: 'inherit', cwd });
  fs.rmSync(tmp, { force: true });
  if (r.error) die(`txcript not found. Fetch it with: node "${path.join(__dirname, 'install-txcript.js')}"`);
  return r.status;
}

function flag(args, f) { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; }
function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  return s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
}

const USAGE = `carry setup --web [--as name] [--with emails]   connect Google Drive in the browser
carry setup [folder] [--as name]                 or use a synced folder (Drive for desktop, Dropbox, iCloud)
carry install-skill                              add /carry to Claude Code, Codex and ~/.agents
carry list | name <chat> <new name>              this laptop's chats, by name
carry share <chat> [--handoff f] [--with emails] [--link]
carry share --project [dir] [--chats 5] [--handoff f] [--with emails]   chats + Claude memory + CLAUDE.md/AGENTS.md
carry note "<name>" --handoff f [--with emails] [--link]   share just a summary (from a chat app)
carry sync | packs
carry open <name | file.carry | Drive link> [--to claude_code|codex|opencode|cursor|pi|chat|here] [--dir project folder]
carry mcp                                        run as an MCP server (Claude Desktop, Codex, ChatGPT, Cursor)`;

module.exports = { redact, slug, cleanPrompt, readPack, TXCRIPT };
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  Promise.resolve((cmds[cmd] || (() => console.log(USAGE)))(args)).catch(e => die(e.message));
}
