// node pairtest.js — friends end to end with three laptops (A, B, C) as three temp homes sharing one synced folder:
// pair, send, inbox, open, continue on B, return, update on A, conflict, projects with memory, auto-return, C → A.
// Uses folder mode, so it needs no Google account. Needs txcript (./bin, or fetched on first use).
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const tx = require('txcript');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'carry-pair-')));
const share = path.join(root, 'shared-folder');
const home = n => path.join(root, n);
for (const n of ['A', 'B', 'C']) fs.mkdirSync(path.join(home(n), 'work'), { recursive: true });
const ts = new Date().toISOString();
const enc = p => p.replace(/[^A-Za-z0-9]/g, '-');

function carry(who, ...args) {
  const env = { ...process.env, HOME: home(who), USERPROFILE: home(who), CARRY_NO_UPDATE_CHECK: '1' };
  delete env.CODEX_HOME;
  const r = spawnSync(process.execPath, [path.join(__dirname, 'carry.js'), ...args], { env, encoding: 'utf8', cwd: path.join(home(who), 'work'), timeout: 120e3 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  console.log(`[${who}] $ carry ${args.join(' ')}\n${out.trim().replace(/^/gm, '    ')}`);
  assert.strictEqual(r.status, 0, `carry ${args[0]} failed for ${who}`);
  return out;
}
const msg = (role, text) => ({ role, timestamp: ts, content: [{ type: 'text', text }] });
function writeSession(who, cwd, id, messages) {
  const dir = path.join(home(who), '.claude', 'projects', enc(cwd));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.jsonl`), tx.fromCommon(JSON.stringify({ meta: { id, timestamp: ts, cwd }, messages }), 'claude_code'));
}
// Simulate someone continuing a Claude Code session: append messages to the session file carry wrote.
function continueSession(who, id, ...texts) {
  const file = require('child_process').execSync(`find "${home(who)}/.claude/projects" -name "${id}.jsonl"`).toString().trim();
  const c = JSON.parse(tx.toCommon(fs.readFileSync(file, 'utf8'), 'claude_code'));
  texts.forEach((t, i) => c.messages.push(msg(i % 2 ? 'assistant' : 'user', t)));
  fs.writeFileSync(file, tx.fromCommon(JSON.stringify(c), 'claude_code'));
  const later = new Date(Date.now() + 2000); fs.utimesSync(file, later, later);
}
const code = out => out.match(/carry1\.[A-Za-z0-9_-]+/)[0];
const newId = out => out.match(/claude --resume ([0-9a-f-]{36})/)[1];
const lastId = out => [...out.matchAll(/claude --resume ([0-9a-f-]{36})/g)].pop()[1];

for (const n of ['A', 'B', 'C']) carry(n, 'setup', share, '--as', n);
const work = n => fs.realpathSync(path.join(home(n), 'work'));
writeSession('A', work('A'), '11111111-0000-4000-8000-000000000001', [msg('user', 'Fix the payment retry bug'), msg('assistant', 'Retries now back off exponentially.')]);

// --- pair A ↔ B once ---
const replyB = code(carry('B', 'friend', 'add', code(carry('A', 'friend', 'add', 'b@example.com'))));
carry('A', 'friend', 'add', replyB);
assert.match(carry('A', 'friends'), /B\s+you send ✓\s+you receive ✓/);

// --- A sends a chat to B; it's sealed in the shared folder ---
assert.match(carry('A', 'share', 'fix-the-payment-retry-bug', '--to', 'B'), /Sent "fix-the-payment-retry-bug" to B's inbox/);
const sealed = fs.readdirSync(path.join(share, 'carry-friends')).map(f => fs.readFileSync(path.join(share, 'carry-friends', f), 'utf8')).join('');
assert(!sealed.includes('payment') && sealed.includes('carry_sealed'), 'inbox/packs must be encrypted');

// --- B picks it from the inbox and continues on B's account ---
assert.match(carry('B', 'inbox'), /1\. fix-the-payment-retry-bug\s+chat from A .* NEW/);
const openB = carry('B', 'open', '1', '--to', 'claude_code', '--no-resume');
assert.match(openB, /carry return fix-the-payment-retry-bug/);
const bId = newId(openB);
assert.doesNotMatch(carry('B', 'inbox'), /NEW/);
continueSession('B', bId, 'Also cap retries at 5', 'Done: max 5 retries.');

// --- B returns it; A gets an update and continues from B's latest ---
assert.match(carry('B', 'return', 'fix-the-payment-retry-bug'), /Returned "fix-the-payment-retry-bug" to A \(\+2 message\(s\)\)/);
assert.match(carry('A', 'inbox'), /1\. fix-the-payment-retry-bug\s+UPDATED by B \(\+2 message\(s\)\)/);
const upd = carry('A', 'open', '1', '--to', 'claude_code', '--no-resume');
assert.match(upd, /now includes B's work \(\+2 message\(s\)\)\. Your previous copy is "fix-the-payment-retry-bug-before-b"/);
const aId = newId(upd);
assert.match(carry('A', 'list'), /fix-the-payment-retry-bug\s+claude_code[\s\S]*fix-the-payment-retry-bug-before-b/);

// --- both keep going: B adds more and returns, A also continued → A gets B's version alongside, nothing overwritten ---
continueSession('B', bId, 'Log each retry', 'Logged.');
carry('B', 'return', 'fix-the-payment-retry-bug');
continueSession('A', aId, 'Rename the retry helper', 'Renamed.');
carry('A', 'inbox');
assert.match(carry('A', 'open', '1', '--to', 'claude_code', '--no-resume'), /You also continued "fix-the-payment-retry-bug" here \(2 new message\(s\)\) while B added 4[\s\S]*"fix-the-payment-retry-bug-from-b"/);

// --- auto-return: B's carry sync sends it back without being asked ---
writeSession('A', work('A'), '11111111-0000-4000-8000-000000000002', [msg('user', 'Write the onboarding email'), msg('assistant', 'Draft ready.')]);
carry('A', 'share', 'write-the-onboarding-email', '--to', 'B', '--auto-return');
carry('B', 'inbox');
const autoId = newId(carry('B', 'open', '1', '--to', 'claude_code', '--no-resume'));
continueSession('B', autoId, 'Make it shorter', 'Shorter now.');
assert.match(carry('B', 'sync'), /returned write-the-onboarding-email to A \(\+2\)/);
assert.match(carry('A', 'inbox'), /write-the-onboarding-email\s+UPDATED by B/);

// --- projects: A sends a repo's chats + memory; B works, adds a chat and notes; returns; A merges ---
const projA = path.join(home('A'), 'shop'); fs.mkdirSync(projA);
fs.writeFileSync(path.join(projA, 'CLAUDE.md'), 'Use pnpm.');
const memA = path.join(home('A'), '.claude', 'projects', enc(fs.realpathSync(projA)), 'memory');
fs.mkdirSync(memA, { recursive: true });
fs.writeFileSync(path.join(memA, 'MEMORY.md'), '- [Payments](payments.md) — provider choice\n');
fs.writeFileSync(path.join(memA, 'payments.md'), 'We use Paddle.');
writeSession('A', fs.realpathSync(projA), '22222222-0000-4000-8000-000000000001', [msg('user', 'Build the cart page'), msg('assistant', 'Cart page done.')]);
assert.match(carry('A', 'share', '--project', 'shop', '--to', 'B'), /Sent project "shop" \(1 chat\(s\)\) to B's inbox/);
carry('B', 'inbox');
const projB = path.join(home('B'), 'shop'); fs.mkdirSync(projB);
const openProj = carry('B', 'open', '1', '--to', 'claude_code', '--dir', projB);
assert.match(openProj, /carry return --project shop/);
const memB = path.join(home('B'), '.claude', 'projects', enc(fs.realpathSync(projB)), 'memory');
assert.strictEqual(fs.readFileSync(path.join(memB, 'payments.md'), 'utf8'), 'We use Paddle.');
fs.writeFileSync(path.join(memB, 'payments.md'), 'We use Paddle, with EU VAT on.'); // B changed a note
fs.writeFileSync(path.join(memB, 'shipping.md'), 'Ship with Shippo.');                // and learned a new one
fs.appendFileSync(path.join(memB, 'MEMORY.md'), '- [Shipping](shipping.md) — carrier choice\n');
writeSession('B', fs.realpathSync(projB), '33333333-0000-4000-8000-000000000001', [msg('user', 'Add shipping rates'), msg('assistant', 'Rates added.')]);
continueSession('B', lastId(openProj), 'Add a coupon field', 'Added.');
assert.match(carry('B', 'return', '--project', 'shop'), /Returned project "shop" to A \(2 chat\(s\)/);
assert.match(carry('A', 'inbox'), /shop\s+UPDATED project by B \(2 chat\(s\)\)/);
carry('A', 'open', '1', '--to', 'claude_code', '--dir', projA);
assert.strictEqual(fs.readFileSync(path.join(memA, 'payments.md'), 'utf8'), 'We use Paddle.', "A's own note must stay");
assert.strictEqual(fs.readFileSync(path.join(memA, 'payments.from-b.md'), 'utf8'), 'We use Paddle, with EU VAT on.');
assert.strictEqual(fs.readFileSync(path.join(memA, 'shipping.md'), 'utf8'), 'Ship with Shippo.');
const idxA = fs.readFileSync(path.join(memA, 'MEMORY.md'), 'utf8');
assert.match(idxA, /Shipping[\s\S]*payments, as changed by B[\s\S]*Update from B/);
assert.doesNotMatch(idxA, /Handoff from A/, "B's handoff note about A must not come back to A");
assert.match(carry('A', 'list'), /add-shipping-rates-from-b/);

// --- C ↔ A: C sends A a chat; A's inbox has it next to B's items ---
const replyA = code(carry('A', 'friend', 'add', code(carry('C', 'friend', 'add', 'a@example.com'))));
carry('C', 'friend', 'add', replyA);
writeSession('C', work('C'), '44444444-0000-4000-8000-000000000001', [msg('user', 'Design the landing page'), msg('assistant', 'Hero and pricing done.')]);
carry('C', 'share', 'design-the-landing-page', '--to', 'A');
assert.match(carry('A', 'inbox'), /design-the-landing-page\s+chat from C .* NEW/);

// --- install-hook writes a SessionEnd hook once ---
assert.match(carry('B', 'install-hook'), /Added a SessionEnd hook/);
assert.match(carry('B', 'install-hook'), /Already installed/);
assert.match(fs.readFileSync(path.join(home('B'), '.claude', 'settings.json'), 'utf8'), /"SessionEnd"[\s\S]*carry\.js\\?" sync/);

if (process.env.KEEP) console.log(`kept: ${root}`); else fs.rmSync(root, { recursive: true, force: true });
console.log(`pairtest ok on ${process.platform}`);
