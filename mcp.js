// `carry mcp`: a stdio MCP server, so Claude Desktop, Codex/ChatGPT, Cursor and others can use carry without a terminal.
// Each tool runs the carry CLI as a child process, so a failing command can't take the server down.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os'), readline = require('readline');

const CARRY = path.join(__dirname, 'carry.js');
const MAX_TEXT = 60000; // keep opened chats within a model's context

function carry(args, timeout = 60e3) {
  const r = spawnSync(process.execPath, [CARRY, ...args], { encoding: 'utf8', timeout, env: { ...process.env, CARRY_NO_UPDATE_CHECK: '1' } });
  const text = `${r.stdout || ''}${r.stderr || ''}`.trim() || (r.error ? r.error.message : '(no output)');
  return { text, isError: r.status !== 0 };
}
function withTempFile(content, fn) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'carry-mcp-')), 'handoff.md');
  fs.writeFileSync(f, content);
  try { return fn(f); } finally { fs.rmSync(path.dirname(f), { recursive: true, force: true }); }
}
const emailArgs = e => (e && e.length ? ['--with', e.join(',')] : []);

const TOOLS = [
  { name: 'carry_status', description: 'Show whether carry is set up on this computer and where shared chats go.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      let c; try { c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.carry', 'config.json'), 'utf8')); } catch { c = {}; }
      let u = {}; try { u = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.carry', 'update.json'), 'utf8')); } catch {}
      const { version } = require('./package.json');
      const upd = u.latest && require('./carry').newer(u.latest, version)
        ? ` carry ${u.latest} is available (running ${version}); tell the user to run "carry update" or restart this app.` : '';
      if (c.web) return { text: `Set up: Google Drive (web). You appear as "${c.user}".${c.friends ? ` Shares go to: ${c.friends.join(', ')}.` : ''}${upd}` };
      if (c.folder) return { text: `Set up: synced folder ${c.folder}. You appear as "${c.user}".${upd}` };
      return { text: `Not set up yet. Call carry_connect_google_drive.${upd}` };
    } },
  { name: 'carry_connect_google_drive', description: 'Connect carry to the user\'s Google Drive. Opens Google sign-in in their browser; they sign in and click Allow. Takes up to 5 minutes.',
    inputSchema: { type: 'object', properties: {
      name: { type: 'string', description: 'Name friends will see' },
      friends: { type: 'array', items: { type: 'string' }, description: 'Emails that receive new shares by default' } }, required: ['name'] },
    run: a => carry(['setup', '--web', '--as', a.name, ...emailArgs(a.friends)], 6 * 60e3) },
  { name: 'carry_list_chats', description: 'List AI chats stored on this computer (Claude Code, Codex) by name, newest first.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'How many (default 20)' } } },
    run: a => carry(['list', '-n', String(a.limit || 20)]) },
  { name: 'carry_share_chat', description: 'Share a chat from carry_list_chats. Secrets are redacted before upload. Write a handoff summary (goal, done, current state, decisions, next steps) and pass it.',
    inputSchema: { type: 'object', properties: {
      chat: { type: 'string', description: 'Chat name from carry_list_chats' },
      handoff: { type: 'string', description: 'Markdown summary for whoever continues it' },
      emails: { type: 'array', items: { type: 'string' } },
      link: { type: 'boolean', description: 'Anyone with the link can open it' } }, required: ['chat'] },
    run: a => {
      const rest = [...emailArgs(a.emails), ...(a.link ? ['--link'] : [])];
      return a.handoff ? withTempFile(a.handoff, f => carry(['share', a.chat, '--handoff', f, ...rest], 3 * 60e3))
        : carry(['share', a.chat, ...rest], 3 * 60e3);
    } },
  { name: 'carry_share_project', description: 'Share a whole project: its recent Claude Code/Codex chats, Claude Code memory notes, CLAUDE.md/AGENTS.md and a handoff. Write a project-level handoff (goal, architecture, decisions, status, next steps) and pass it. The code itself travels via git.',
    inputSchema: { type: 'object', properties: {
      dir: { type: 'string', description: 'Project folder (absolute path)' },
      handoff: { type: 'string' },
      chats: { type: 'number', description: 'How many recent chats to include (default 5)' },
      emails: { type: 'array', items: { type: 'string' } },
      link: { type: 'boolean' } }, required: ['dir'] },
    run: a => {
      const rest = ['--chats', String(a.chats || 5), ...emailArgs(a.emails), ...(a.link ? ['--link'] : [])];
      return a.handoff ? withTempFile(a.handoff, f => carry(['share', '--project', a.dir, '--handoff', f, ...rest], 5 * 60e3))
        : carry(['share', '--project', a.dir, ...rest], 5 * 60e3);
    } },
  { name: 'carry_share_summary', description: 'Share THIS conversation from a chat app (Claude app, ChatGPT), whose history carry cannot read. Write a thorough handoff of the conversation so far and pass it as summary.',
    inputSchema: { type: 'object', properties: {
      name: { type: 'string', description: 'Short name, e.g. "auth bug in login"' },
      summary: { type: 'string', description: 'Markdown: goal, what was done, current state, decisions and why, open questions, next steps' },
      emails: { type: 'array', items: { type: 'string' } },
      link: { type: 'boolean' } }, required: ['name', 'summary'] },
    run: a => withTempFile(a.summary, f => carry(['note', a.name, '--handoff', f, ...emailArgs(a.emails), ...(a.link ? ['--link'] : [])], 3 * 60e3)) },
  { name: 'carry_list_shared', description: 'List shared chats: everyone\'s in synced-folder mode, your own shares with links in Google Drive mode.',
    inputSchema: { type: 'object', properties: {} },
    run: () => carry(['packs']) },
  { name: 'carry_open', description: 'Open a shared chat (name, .carry file path, or Drive link). By default returns its handoff and history so you can continue it right here. Set continue_in to load it as a real session in a coding tool instead.',
    inputSchema: { type: 'object', properties: {
      ref: { type: 'string', description: 'Pack name, path to a .carry file, or Google Drive link' },
      continue_in: { type: 'string', enum: ['claude_code', 'codex', 'opencode', 'cursor', 'pi'] },
      dir: { type: 'string', description: 'For project packs with continue_in: the local project folder (absolute path)' } }, required: ['ref'] },
    run: a => {
      if (a.continue_in) return carry(['open', a.ref, '--to', a.continue_in, '--no-resume', ...(a.dir ? ['--dir', a.dir] : [])], 5 * 60e3);
      const r = carry(['open', a.ref, '--to', 'here'], 5 * 60e3);
      return r.text.length > MAX_TEXT ? { ...r, text: `${r.text.slice(0, MAX_TEXT)}\n\n[history truncated; the handoff above has the essentials]` } : r;
    } },
];

function serve() {
  console.log = console.error; // stdout is the protocol channel
  const send = m => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...m })}\n`);
  readline.createInterface({ input: process.stdin }).on('line', line => {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params = {} } = msg;
    if (id === undefined) return; // notifications need no reply
    if (method === 'initialize') {
      return send({ id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} },
        serverInfo: { name: 'carry', version: require('./package.json').version } } });
    }
    if (method === 'ping') return send({ id, result: {} });
    if (method === 'tools/list') return send({ id, result: { tools: TOOLS.map(({ run, ...t }) => t) } });
    if (method === 'tools/call') {
      const tool = TOOLS.find(t => t.name === params.name);
      if (!tool) return send({ id, error: { code: -32602, message: `Unknown tool: ${params.name}` } });
      let r; try { r = tool.run(params.arguments || {}); } catch (e) { r = { text: e.message, isError: true }; }
      return send({ id, result: { content: [{ type: 'text', text: r.text }], isError: !!r.isError } });
    }
    send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  });
}

module.exports = { serve, TOOLS };
