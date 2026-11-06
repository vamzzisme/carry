// Runs on `npm install`: downloads the txcript CLI for this OS into ./bin, checksum-verified.
// Never fails the install; if it can't, carry falls back to a txcript on your PATH.
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
const BIN = path.join(__dirname, 'bin');
const EXE = process.platform === 'win32' ? 'txcript.exe' : 'txcript';

async function main() {
  if (fs.existsSync(path.join(BIN, EXE))) return;
  const target = TARGETS[`${process.platform}-${process.arch}`];
  if (!target) return console.warn(`carry: no txcript build for ${process.platform}-${process.arch}; install it yourself and put it on PATH.`);
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
  fs.mkdirSync(BIN, { recursive: true });
  fs.copyFileSync(found, path.join(BIN, EXE));
  fs.chmodSync(path.join(BIN, EXE), 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`carry: installed txcript ${VERSION} → ${path.join(BIN, EXE)}`);
}

main().catch(e => console.warn(`carry: couldn't install txcript (${e.message}). Install it yourself: https://github.com/skillsynchq/txcript/releases`));
