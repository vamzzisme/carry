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
