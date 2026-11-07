// Curtain (once per session, tap to skip), mobile drawer, copy buttons, feedback via mail app.
const curtain = document.getElementById('curtain');
if (curtain) {
  const hide = () => {
    curtain.classList.add('gone');
    try { sessionStorage.setItem('vxmz-curtain', '1'); } catch (e) {}
  };
  if (document.documentElement.classList.contains('no-curtain')) hide();
  else { curtain.addEventListener('click', hide); setTimeout(hide, 1500); }
}

const nav = document.getElementById('nav'), menu = document.getElementById('menu');
menu?.addEventListener('click', () => menu.setAttribute('aria-expanded', nav.classList.toggle('open')));
nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); }));

// Hero: type the share on your laptop, send that card back, bring Riya's forward, type the open, loop.
// Without JS or with reduced motion, the static markup stays as is.
const stack = document.getElementById('stack');
if (stack && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [a, b] = stack.querySelectorAll('.term');
  const scenes = [
    { card: a, other: b, lines: [
      ['cmd', 'carry list'],
      ['out', 'auth-bug-in-login        claude_code   2h ago'],
      ['out', 'stacked-reveal-effect    codex         3d ago'],
      ['cmd', 'carry share auth-bug-in-login --to riya'],
      ['ok', 'Sent "auth-bug-in-login" to riya\'s inbox.'],
      ['c', '  2 secrets redacted · encrypted for riya']] },
    { card: b, other: a, lines: [
      ['cmd', 'carry inbox'],
      ['out', '  1. auth-bug-in-login   chat from vamshi   NEW'],
      ['cmd', 'carry open 1 --to codex'],
      ['ok', '  Chat loaded into Codex on Riya\'s account'],
      ['c', '  done here? carry return auth-bug-in-login']] },
  ];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const line = (kind, text) => kind === 'cmd' ? `<span class="p">$</span> ${esc(text)}` : kind === 'out' ? esc(text) : `<span class="${kind}">${esc(text)}</span>`;
  stack.classList.add('live');
  (async function loop() {
    for (;;) {
      for (const { card, other, lines } of scenes) {
        const pre = card.querySelector('pre');
        pre.innerHTML = '<span class="caret"></span>';
        card.classList.replace('back', 'front') || card.classList.add('front');
        other.classList.replace('front', 'back') || other.classList.add('back');
        await wait(900);
        let done = '';
        for (const [kind, text] of lines) {
          if (kind === 'cmd') {
            for (let i = 1; i <= text.length; i++) {
              pre.innerHTML = `${done}<span class="p">$</span> ${esc(text.slice(0, i))}<span class="caret"></span>`;
              await wait(28 + Math.random() * 40);
            }
            await wait(350);
          } else await wait(220);
          done += `${line(kind, text)}\n`;
          pre.innerHTML = `${done}<span class="caret"></span>`;
        }
        await wait(2200);
      }
    }
  })();
}

// OS and app tabs. OS defaults to the visitor's system and is remembered; every OS picker on the page stays in sync.
const pick = { os: /Win/i.test(navigator.userAgent) ? 'win' : /Linux|X11/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? 'linux' : 'mac', app: 'claude' };
try { pick.os = localStorage.getItem('carry-os') || pick.os; } catch (e) {}
function applyTabs() {
  document.querySelectorAll('[data-os-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.osTab === pick.os));
  document.querySelectorAll('[data-app-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.appTab === pick.app));
  document.querySelectorAll('[data-os], [data-app]').forEach(el => {
    const osOk = !el.dataset.os || el.dataset.os.split(' ').includes(pick.os);
    const appOk = !el.dataset.app || el.dataset.app === pick.app;
    el.classList.toggle('hide', !(osOk && appOk));
  });
}
document.querySelectorAll('[data-os-tab]').forEach(b => b.addEventListener('click', () => {
  pick.os = b.dataset.osTab; applyTabs();
  try { localStorage.setItem('carry-os', pick.os); } catch (e) {}
}));
document.querySelectorAll('[data-app-tab]').forEach(b => b.addEventListener('click', () => { pick.app = b.dataset.appTab; applyTabs(); }));
document.querySelectorAll('.tab').forEach(b => b.setAttribute('role', 'tab'));
applyTabs();

document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; }
  catch (e) { b.textContent = 'Select and copy'; }
  setTimeout(() => (b.textContent = 'Copy'), 1600);
}));

document.getElementById('fb')?.addEventListener('submit', e => {
  e.preventDefault();
  const type = document.getElementById('fb-type').value;
  const name = document.getElementById('fb-name').value.trim();
  const msg = document.getElementById('fb-msg').value.trim();
  const body = `${msg}\n\n${name ? `From: ${name}\n` : ''}Sent from the carry site`;
  location.href = `mailto:pvamshikrishna369@gmail.com?subject=${encodeURIComponent(`carry: ${type}`)}&body=${encodeURIComponent(body)}`;
});
