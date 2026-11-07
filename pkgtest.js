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
run('npm', ['pack', '--pack-destination', tmp]); // npm 12 changed `pack --json`, so just find the tarball
const tgz = path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith('.tgz')));
const prefix = path.join(tmp, 'g');
run('npm', ['install', '-g', '--prefix', prefix, tgz]);

const pkg = path.join(prefix, win ? '' : 'lib', 'node_modules', '@heyvamz', 'carry');
const shipped = fs.readdirSync(pkg).sort();
console.log('installed files:', shipped.join(', '));
for (const f of ['carry.js', 'drive.js', 'mcp.js', 'system.js', 'install-txcript.js', 'skills', 'README.md', 'LICENSE', 'CHANGELOG.md']) assert(shipped.includes(f), `missing ${f}`);
for (const f of ['site', 'smoke.js', 'test.js', 'status.md', 'MISTAKES.md', '.github']) assert(!shipped.includes(f), `should not ship ${f}`);
// npm <= 11 runs the postinstall (./bin/txcript); npm 12 blocks it, and carry fetches txcript on first use instead.
const home = path.join(tmp, 'home'); fs.mkdirSync(home);
// Hide any txcript already on PATH, so this checks what a new user gets.
const pathKey = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH');
const cleanPath = process.env[pathKey].split(path.delimiter).filter(d => !['txcript', 'txcript.exe'].some(e => fs.existsSync(path.join(d, e)))).join(path.delimiter);
const doctor = run(process.execPath, [path.join(pkg, 'carry.js'), 'doctor'], { shell: false, env: { ...process.env, [pathKey]: cleanPath, HOME: home, USERPROFILE: home, TXCRIPT: '' } });
console.log(doctor);
const tx = doctor.match(/^txcript: (.+)$/m)[1].trim();
assert(fs.existsSync(tx), `txcript missing at ${tx}`);
console.log(`txcript came from: ${fs.realpathSync(tx).startsWith(fs.realpathSync(pkg)) ? 'npm postinstall' : 'first-use download'}`);
assert(fs.existsSync(path.join(prefix, win ? 'carry.cmd' : path.join('bin', 'carry'))), 'carry command not linked');

const version = run(process.execPath, [path.join(pkg, 'carry.js'), '--version'], { shell: false });
assert.strictEqual(version, require('./package.json').version);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`pkgtest ok on ${process.platform}: carry ${version}`);
