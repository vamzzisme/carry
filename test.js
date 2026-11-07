// node test.js — self-check for redaction and naming.
const assert = require('assert');
const { redact, slug, cleanPrompt } = require('./carry');
const { fileIdFrom } = require('./drive');

const secrets = {
  openai: 'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
  anthropic: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
  github: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  aws: 'AKIAABCDEFGHIJKLMNOP',
  google: 'AIzaSyA-abcdefghijklmnopqrstuvwxyz12345',
  sarvam: 'sk_abcd1234_ABCDEFGHIJKLMNOPQRSTUVWX',
  jwt:'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop',
};
const doc = { messages: [
  { role: 'user', content: `keys: ${Object.values(secrets).join(' ')}` },
  { role: 'assistant', content: 'Put SARVAM_API_KEY=supersecretvalue123 in .env\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz' },
  { role: 'user', content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----' },
  { role: 'user', content: 'Create .env with SARVAM_API_KEY= and keep the tokenizer docs' }, // nothing to redact here
] };
const { text, count } = redact(JSON.stringify(doc));
const out = JSON.parse(text); // must stay valid JSON
for (const [k, v] of Object.entries(secrets)) assert(!text.includes(v), `${k} leaked`);
assert(!text.includes('supersecretvalue123'), 'env value leaked');
assert(text.includes('SARVAM_API_KEY=[REDACTED]'), 'env name should stay');
assert(!text.includes('MIIEow'), 'private key leaked');
assert(text.includes('Bearer [REDACTED]'));
assert.strictEqual(out.messages[3].content, doc.messages[3].content, 'false positive');
assert.strictEqual(count, 10);
assert.strictEqual(redact('OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz').count, 1, 'KEY=sk-... counted once');

assert.strictEqual(slug('Fix the Auth bug in login.ts please now'), 'fix-the-auth-bug-in');
assert.strictEqual(slug('!!!'), 'chat');
assert.strictEqual(cleanPrompt('<system-reminder>x</system-reminder>\n<pasted_content id="1">Set up Sarvam</pasted_content>'), 'Set up Sarvam');
assert.strictEqual(cleanPrompt('<ide_opened_file>The user opened the file /a/b.ts</ide_opened_file>\n\nfix the slides'), 'fix the slides');
const fid = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
assert.strictEqual(fileIdFrom(`https://drive.google.com/file/d/${fid}/view?usp=drivesdk`), fid);
assert.strictEqual(fileIdFrom(`https://drive.google.com/open?id=${fid}`), fid);
assert.strictEqual(fileIdFrom('auth-bug'), null);
assert.strictEqual(fileIdFrom('/Users/me/Downloads/auth-bug.carry'), null);
const { openCmd, revealCmd, copyCmds } = require('./system');
const url = 'https://accounts.google.com/o/oauth2/v2/auth?a=1&b=2';
assert.deepStrictEqual(openCmd(url, 'darwin'), ['open', [url]]);
assert.deepStrictEqual(openCmd(url, 'win32'), ['rundll32', ['url.dll,FileProtocolHandler', url]]); // no cmd.exe, so '&' survives
assert.deepStrictEqual(openCmd(url, 'linux'), ['xdg-open', [url]]);
assert.deepStrictEqual(revealCmd('C:\\u\\handoff.md', 'win32'), ['explorer', ['/select,C:\\u\\handoff.md']]);
assert.strictEqual(copyCmds('linux').length, 3);
const { newer } = require('./carry');
assert(newer('0.3.1', '0.3.0') && newer('1.0.0', '0.9.9') && newer('0.10.0', '0.9.0'));
assert(!newer('0.3.0', '0.3.0') && !newer('0.2.9', '0.3.0'));
console.log('ok');
