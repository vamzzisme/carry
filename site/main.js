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
