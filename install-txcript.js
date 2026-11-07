// Downloads the txcript CLI for this OS, checksum-verified.
// Runs on `npm install` into ./bin. npm 12 blocks install scripts by default, so carry also calls install() on first use,
// into ~/.carry/bin/<version>/ (see txcriptPath() in carry.js).
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');

const VERSION = '0.14.4';
const TARGETS = {
  'darwin-arm64': 'aarch64-apple-darwin.tar.gz',
  'darwin-x64': 'x86_64-apple-darwin.tar.gz',
  'linux-arm64': 'aarch64-unknown-linux-gnu.tar.gz',
  'linux-x64': 'x86_64-unknown-linux-gnu.tar.gz',
  'win32-x64': 'x86_64-pc-windows-msvc.zip',
};
const EXE = process.platform === 'win32' ? 'txcript.exe' : 'txcript';
const USER_DIR = path.join(os.homedir(), '.carry', 'bin', VERSION);

// Returns the path of the installed binary; throws if it can't.
async function install(dir) {
  const dest = path.join(dir, EXE);
  if (fs.existsSync(dest)) return dest;
  const target = TARGETS[`${process.platform}-${process.arch}`];
  if (!target) throw new Error(`no txcript build for ${process.platform}-${process.arch}`);
  const url = `https://github.com/skillsynchq/txcript/releases/download/v${VERSION}/txcript-${target}`;
  const get = async u => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return Buffer.from(await r.arrayBuffer()); };
  const [archive, sum] = await Promise.all([get(url), get(`${url}.sha256`)]);
  const want = sum.toString().trim().split(/\s+/)[0];
  if (crypto.createHash('sha256').update(archive).digest('hex') !== want) throw new Error('txcript checksum mismatch');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txcript-'));
  const file = path.join(tmp, `txcript-${target}`);
  fs.writeFileSync(file, archive);
  // bsdtar (macOS, Windows 10+) and GNU tar both read .tar.gz; Windows' tar.exe also reads .zip.
  const r = spawnSync('tar', ['-xf', file, '-C', tmp]);
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr}`);
  const found = (function find(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { const f = find(p); if (f) return f; } else if (e.name === EXE) return p;
    }
  })(tmp);
  if (!found) throw new Error(`${EXE} not found in the download`);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(found, dest);
  fs.chmodSync(dest, 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
  return dest;
}

module.exports = { install, VERSION, EXE, USER_DIR };

// As an npm postinstall script: never fail the install; carry fetches it on first use instead.
if (require.main === module) {
  install(path.join(__dirname, 'bin'))
    .then(p => console.log(`carry: installed txcript ${VERSION} → ${p}`))
    .catch(e => console.warn(`carry: couldn't install txcript now (${e.message}); carry will fetch it the first time it's needed.`));
}
