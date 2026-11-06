// Google Drive over the web API: browser sign-in (loopback + PKCE), upload, share, public download.
// Scope is drive.file: carry only ever sees files it created itself.
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');

const TOKEN_FILE = path.join(os.homedir(), '.carry', 'google.json');
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3', UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// Fill in once the Google Cloud "Desktop app" OAuth client exists (README → "Google sign-in app").
// For desktop apps Google does not treat the secret as confidential, so shipping it in the CLI is expected.
const CLIENT = { id: '575233295315-9jlene1bh4jb8idrn3k7o130lh8vd0t2.apps.googleusercontent.com', secret: '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' };

function client() {
  const id = process.env.CARRY_GOOGLE_CLIENT_ID || CLIENT.id, secret = process.env.CARRY_GOOGLE_CLIENT_SECRET || CLIENT.secret;
  if (!id || !secret) throw new Error('Google client not configured: set CARRY_GOOGLE_CLIENT_ID and CARRY_GOOGLE_CLIENT_SECRET (see README).');
  return { id, secret };
}

async function tokenRequest(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams(params) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google sign-in failed: ${j.error_description || j.error || r.status}`);
  return j;
}

// Opens Google's sign-in page in the browser and waits for the redirect back to 127.0.0.1.
async function signIn() {
  const { id, secret } = client();
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  let redirect;
  const code = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.searchParams.get('state') !== state) { res.end(); return; }
      const err = u.searchParams.get('error');
      res.end(err ? 'Sign-in cancelled. You can close this tab.' : 'carry is connected to your Google Drive. You can close this tab.');
      srv.close();
      err ? reject(new Error(`Google sign-in: ${err}`)) : resolve(u.searchParams.get('code'));
    }).listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${srv.address().port}`; // read before close(): address() is null afterwards
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      Object.entries({ client_id: id, redirect_uri: redirect, response_type: 'code', scope: SCOPE,
        code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state })
        .forEach(([k, v]) => auth.searchParams.set(k, v));
      console.log(`Opening Google sign-in in your browser. If it doesn't open, visit:\n${auth}`);
      spawnSync('open', [auth.toString()]);
    });
    setTimeout(() => { srv.close(); reject(new Error('Timed out waiting for Google sign-in (5 min).')); }, 5 * 60e3).unref();
  });
  const t = await tokenRequest({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
  save({ refresh_token: t.refresh_token, access_token: t.access_token, expires: Date.now() + t.expires_in * 1000 });
}

function save(t) { fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true }); fs.writeFileSync(TOKEN_FILE, JSON.stringify(t), { mode: 0o600 }); }

async function accessToken() {
  let t; try { t = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { throw new Error('Not signed in to Google. Run: carry setup --web'); }
  if (t.expires - 60e3 > Date.now()) return t.access_token;
  const { id, secret } = client();
  const r = await tokenRequest({ refresh_token: t.refresh_token, client_id: id, client_secret: secret, grant_type: 'refresh_token' });
  save({ ...t, access_token: r.access_token, expires: Date.now() + r.expires_in * 1000 });
  return r.access_token;
}

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${await accessToken()}`, ...opts.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Drive: ${j.error?.message || r.status}`);
  return j;
}

const json = body => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

async function makeFolder(name) {
  return (await api(`${API}/files?fields=id`, { method: 'POST', ...json({ name, mimeType: 'application/vnd.google-apps.folder' }) })).id;
}

// Create or replace a file; returns { id, webViewLink }.
async function upload(name, content, folderId, fileId) {
  if (fileId) return api(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id,webViewLink`, { method: 'PATCH', body: content });
  const b = crypto.randomBytes(12).toString('hex');
  const body = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n` +
    `--${b}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${b}--`;
  return api(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, { method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${b}` } });
}

// Google emails each person a link. anyone=true makes it readable by anyone holding the link.
async function share(fileId, emails, anyone, message) {
  for (const e of emails) {
    await api(`${API}/files/${fileId}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(message)}`,
      { method: 'POST', ...json({ type: 'user', role: 'reader', emailAddress: e }) });
  }
  if (anyone) await api(`${API}/files/${fileId}/permissions`, { method: 'POST', ...json({ type: 'anyone', role: 'reader' }) });
}

function fileIdFrom(link) {
  const m = String(link).match(/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/);
  return m && (m[1] || m[2]);
}

// Works only for "anyone with the link" files; returns null otherwise (caller falls back to the browser).
async function publicDownload(fileId) {
  try {
    const r = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    const text = await r.text();
    return r.ok && text.trimStart().startsWith('{') ? text : null;
  } catch { return null; }
}

module.exports = { signIn, makeFolder, upload, share, fileIdFrom, publicDownload };
