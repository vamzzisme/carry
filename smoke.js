// node smoke.js — end-to-end run of carry in a throwaway home folder with two fake chats (Claude Code + Codex).
// Runs on macOS, Linux and Windows. Uses the txcript that `npm install` fetched (or $TXCRIPT) to test `open --to <tool>`.
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const { spawnSync } = require('child_process');
const tx = require('txcript');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'carry-smoke-'));
const env = { ...process.env, HOME: home, USERPROFILE: home };
delete env.CODEX_HOME;
const ts = '2026-01-01T00:00:00.000Z';
const chat = (id, prompt, reply) => JSON.stringify({ meta: { id, timestamp: ts, cwd: home }, messages: [
  { role: 'user', timestamp: ts, content: [{ type: 'text', text: prompt }] },
  { role: 'assistant', timestamp: ts, content: [{ type: 'text', text: reply }] },
] });

const ccDir = path.join(home, '.claude', 'projects', '-tmp-demo');
fs.mkdirSync(ccDir, { recursive: true });
fs.writeFileSync(path.join(ccDir, '11111111-2222-3333-4444-555555555555.jsonl'),
  tx.fromCommon(chat('11111111-2222-3333-4444-555555555555', 'Fix the login bug please', 'Fixed it. Put OPENAI_API_KEY=sk-fakefakefakefakefakefake1234 in .env'), 'claude_code'));
const cxDir = path.join(home, '.codex', 'sessions', '2026', '01', '01');
fs.mkdirSync(cxDir, { recursive: true });
fs.writeFileSync(path.join(cxDir, 'rollout-2026-01-01T00-00-00-66666666-7777-8888-9999-000000000000.jsonl.zst'),
  zlib.zstdCompressSync(tx.fromCommon(chat('66666666-7777-8888-9999-000000000000', 'Add dark mode to settings', 'Added a theme toggle.'), 'codex')));

function carry(...args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'carry.js'), ...args], { env, encoding: 'utf8', cwd: home, timeout: 60e3 });
  const out = (r.stdout || '') + (r.stderr || '');
  console.log(`$ carry ${args.join(' ')}\n${out.trim().replace(/^/gm, '  ')}`);
  assert.strictEqual(r.status, 0, `carry ${args[0]} exited ${r.status}`);
  return out;
}

assert.match(carry('install-skill'), /\/carry added to Claude Code[\s\S]*\/carry added to Codex/);
assert(fs.existsSync(path.join(home, '.claude', 'skills', 'carry', 'SKILL.md')));
assert(fs.existsSync(path.join(home, '.codex', 'skills', 'carry', 'SKILL.md')));

const share = path.join(home, 'share');
carry('setup', share, '--as', 'ci');
const list = carry('list');
assert.match(list, /fix-the-login-bug-please\s+claude_code/);
assert.match(list, /add-dark-mode-to-settings\s+codex/); // .zst Codex chat found and named

assert.match(carry('share', 'fix-the-login-bug-please'), /1 secret\(s\) redacted/);
carry('share', 'add-dark-mode-to-settings');
const pack = fs.readFileSync(path.join(share, 'fix-the-login-bug-please.carry'), 'utf8');
assert(!pack.includes('sk-fake'), 'secret leaked into pack');
assert(JSON.parse(pack).handoff.includes('Fix the login bug please'));

const packs = carry('packs');
assert.match(packs, /fix-the-login-bug-please\s+by ci/);
assert.match(packs, /add-dark-mode-to-settings\s+by ci/);

// Chat-app route: clipboard/file window may not exist on CI; carry must still succeed and point at handoff.md.
assert.match(carry('open', 'add-dark-mode-to-settings', '--to', 'chat'), /handoff\.md/);
assert(fs.existsSync(path.join(home, '.carry', 'opened', 'add-dark-mode-to-settings', 'handoff.md')));

// TXCRIPT comes from `npm install` (./bin) or $TXCRIPT. On CI it must exist, so the open steps can't be skipped.
const { TXCRIPT } = require('./carry');
const haveTx = fs.existsSync(TXCRIPT);
assert(haveTx || !process.env.CI, `CI: txcript missing at ${TXCRIPT} (npm install should have fetched it)`);
if (haveTx) {
  assert.match(carry('open', 'add-dark-mode-to-settings', '--to', 'claude_code', '--no-resume'), /resume with: claude --resume/);
  assert.match(carry('open', path.join(share, 'fix-the-login-bug-please.carry'), '--to', 'codex', '--no-resume'), /resume with: codex resume/);
} else console.log('(txcript not installed: skipped open --to claude_code/codex)');

fs.rmSync(home, { recursive: true, force: true });
console.log(`smoke ok on ${process.platform}`);
