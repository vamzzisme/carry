// The few things that differ per OS: opening a URL, showing a file, the clipboard, Google Drive for desktop's folder.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

// [command, args] per platform. rundll32 avoids cmd.exe, which would split URLs on '&'.
function openCmd(target, platform = process.platform) {
  if (platform === 'darwin') return ['open', [target]];
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', target]];
  return ['xdg-open', [target]];
}
function revealCmd(file, platform = process.platform) {
  if (platform === 'darwin') return ['open', ['-R', file]];
  if (platform === 'win32') return ['explorer', [`/select,${file}`]];
  return ['xdg-open', [path.dirname(file)]];
}
function copyCmds(platform = process.platform) {
  if (platform === 'darwin') return [['pbcopy', []]];
  if (platform === 'win32') return [['clip', []]];
  return [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];
}

const run = ([cmd, args], opts) => { const r = spawnSync(cmd, args, opts); return !r.error && r.status === 0; };
const openTarget = t => run(openCmd(t));
const reveal = f => run(revealCmd(f));
const copyText = text => copyCmds().some(c => run(c, { input: text }));

// Google Drive for desktop: macOS mounts it under ~/Library/CloudStorage, Windows as a drive letter (G: by default). Linux has no client.
function driveFolder() {
  if (process.platform === 'darwin') {
    const cs = path.join(os.homedir(), 'Library', 'CloudStorage');
    const gd = (fs.existsSync(cs) ? fs.readdirSync(cs) : []).find(d => d.startsWith('GoogleDrive-'));
    return gd && path.join(cs, gd, 'My Drive');
  }
  if (process.platform === 'win32') {
    for (const l of 'GDEFHIJKLMNOPQRSTUVWXYZ') if (fs.existsSync(`${l}:\\My Drive`)) return `${l}:\\My Drive`;
  }
  return null;
}

module.exports = { openTarget, reveal, copyText, driveFolder, openCmd, revealCmd, copyCmds };
