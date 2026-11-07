// Builds carry-<version>.mcpb: a one-click Claude Desktop extension. Run: node mcpb/build.js
// Stages the npm package (same files users get from npm), adds manifest.json + icon, packs with @anthropic-ai/mcpb.
const { execFileSync: run } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const { TOOLS } = require('../mcp');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'carry-mcpb-'));
const sh = (cmd, args, cwd) => run(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

sh('npm', ['pack', '--pack-destination', stage], root);
const tgz = fs.readdirSync(stage).find(f => f.endsWith('.tgz'));
sh('tar', ['xzf', tgz], stage);
const dir = path.join(stage, 'package');
// --ignore-scripts: txcript's binary is fetched on first use into ~/.carry/bin, not shipped in the bundle
sh('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], dir);
fs.copyFileSync(path.join(__dirname, 'icon.png'), path.join(dir, 'icon.png'));

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  manifest_version: '0.3',
  name: 'carry',
  display_name: 'carry',
  version: pkg.version,
  description: 'Share Claude Code and Codex chats or whole projects with friends through your own Google Drive.',
  long_description: 'Ask Claude to share a chat or project, check your carry inbox, open what a friend sent, or send it back with your work. Secrets are redacted before upload. carry has no server: files go only to your own Google Drive.',
  author: { name: 'heyvamz', url: 'https://x.com/heyvamz' },
  repository: { type: 'git', url: 'https://github.com/vamzzisme/carry' },
  homepage: 'https://carry-si.vercel.app',
  documentation: 'https://github.com/vamzzisme/carry#readme',
  support: 'https://github.com/vamzzisme/carry/issues',
  icon: 'icon.png',
  server: {
    type: 'node',
    entry_point: 'carry.js',
    mcp_config: { command: 'node', args: ['${__dirname}/carry.js', 'mcp'], env: { CARRY_NO_UPDATE_CHECK: '1' } },
  },
  tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
  keywords: pkg.keywords,
  license: pkg.license,
  privacy_policies: ['https://carry-si.vercel.app/privacy'],
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: pkg.engines.node } },
}, null, 2));

const out = path.join(root, `carry-${pkg.version}.mcpb`);
sh('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'validate', path.join(dir, 'manifest.json')], dir);
sh('npx', ['-y', '@anthropic-ai/mcpb@2.1.2', 'pack', dir, out], root);
fs.rmSync(stage, { recursive: true, force: true });
console.log(`\nBuilt ${out}`);
