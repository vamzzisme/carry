// node pkgtest.js — pack carry like `npm publish` would, install it globally into a temp prefix, and check it works.
// Catches a wrong "files" list, a broken bin, or txcript not being fetched on install.
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const win = process.platform === 'win32';
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: win, ...opts });
  assert.strictEqual(r.status, 0, `${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carry-pkg-'));
const tgz = path.join(tmp, JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tmp]))[0].filename);
const prefix = path.join(tmp, 'g');
run('npm', ['install', '-g', '--prefix', prefix, tgz]);

const pkg = path.join(prefix, win ? '' : 'lib', 'node_modules', '@heyvamz', 'carry');
const shipped = fs.readdirSync(pkg).sort();
console.log('installed files:', shipped.join(', '));
for (const f of ['carry.js', 'drive.js', 'mcp.js', 'system.js', 'install-txcript.js', 'skills', 'README.md', 'LICENSE', 'CHANGELOG.md']) assert(shipped.includes(f), `missing ${f}`);
for (const f of ['site', 'smoke.js', 'test.js', 'status.md', 'MISTAKES.md', '.github']) assert(!shipped.includes(f), `should not ship ${f}`);
assert(fs.existsSync(path.join(pkg, 'bin', win ? 'txcript.exe' : 'txcript')), 'txcript not fetched on install');
assert(fs.existsSync(path.join(prefix, win ? 'carry.cmd' : path.join('bin', 'carry'))), 'carry command not linked');

const version = run(process.execPath, [path.join(pkg, 'carry.js'), '--version'], { shell: false });
assert.strictEqual(version, require('./package.json').version);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`pkgtest ok on ${process.platform}: carry ${version}`);
