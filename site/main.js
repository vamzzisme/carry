// Logo intro, sidebar menu + "on this page", setup prompt, hero terminals, OS/app tabs, copy buttons, feedback.
// Logo intro (the C draws, the arrow slides in): once per visit.
(() => {
  try { if (sessionStorage.getItem('carry-mark')) return; sessionStorage.setItem('carry-mark', '1'); } catch (e) {}
  const mark = document.querySelector('.brand .mark');
  if (!mark) return;
  mark.classList.add('intro');
  // Drop the intro once the arrow has slid in, or ending a hover would restart it (the arrow would fade in again).
  mark.querySelector('.arrow').addEventListener('animationend', () => mark.classList.remove('intro'), { once: true });
})();


// "carry" in running text gets the accent, so it reads as the product's name and not the verb. Not in code, commands,
// labels, buttons or the footer, and not inside names like carry-si.vercel.app, @heyvamz/carry or carry.mcpb.
const NAME = /(?<![\w/@.-])(carry)(?![\w/@-]|\.\w)/;
const texts = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT,
  { acceptNode: n => NAME.test(n.data) && !n.parentElement.closest('code, pre, .codebox, .label, footer, button, .btn, .tags, .pname, [data-plain]') ? 1 : 2 });
const hits = []; for (let n; (n = texts.nextNode());) hits.push(n);
hits.forEach(n => {
  const parts = n.data.split(new RegExp(NAME.source, 'g'));
  n.replaceWith(...parts.map((t, i) => i % 2 ? Object.assign(document.createElement('span'), { className: 'pname', textContent: t }) : t));
});

// Small screens: the sidebar is a top bar with a menu button.
const side = document.querySelector('.side'), menu = document.getElementById('menu');
menu?.addEventListener('click', () => menu.setAttribute('aria-expanded', side.classList.toggle('open')));
side?.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => side.classList.remove('open')));

// "On this page": built from the page's h2s (and docs h3s marked data-toc), highlighted while scrolling.
const toc = document.querySelector('.toc');
if (toc) {
  const heads = [...document.querySelectorAll('main h2[id], main h3[id][data-toc]')];
  if (heads.length > 1) {
    toc.innerHTML = '<div class="label">On this page</div><div class="toc-list">' + heads.map(h =>
      `<a href="#${h.id}"${h.tagName === 'H3' ? ' class="sub"' : ''}>${h.dataset.toc || h.textContent}</a>`).join('') + '</div>';
    const list = toc.querySelector('.toc-list'), links = [...list.querySelectorAll('a')];
    const spy = () => {
      let i = 0;
      heads.forEach((h, n) => { if (h.getBoundingClientRect().top < innerHeight * .3) i = n; });
      links.forEach((a, n) => a.classList.toggle('on', n === i));
      const top = links[i].offsetTop - list.offsetTop; // keep the active entry visible when the list scrolls
      if (top < list.scrollTop + 30 || top > list.scrollTop + list.clientHeight - 30) list.scrollTop = top - list.clientHeight / 2;
    };
    addEventListener('scroll', spy, { passive: true }); spy();
  }
}

// Umami custom events (install intent). No-op when Umami is blocked or Do Not Track is on.
const track = (name, data) => { try { window.umami?.track(name, data); } catch (e) {} };

// Copy setup prompt: one line any AI can act on, plus "open in" links.
const PROMPT = 'Set up carry for me. Read https://carry-si.vercel.app/setup.md and follow it.';
document.querySelectorAll('.prompt').forEach(box => {
  const copyBtn = box.querySelector('.copy-prompt'), label = copyBtn.querySelector('span');
  copyBtn.addEventListener('click', async () => {
    track('copy-setup-prompt');
    try { await navigator.clipboard.writeText(PROMPT); label.textContent = 'Setup prompt copied'; }
    catch (e) { box.classList.add('open'); label.textContent = 'Copy it below'; }
    setTimeout(() => (label.textContent = 'Copy setup prompt'), 1800);
  });
  box.querySelector('.more').addEventListener('click', e => { e.stopPropagation(); box.classList.toggle('open'); });
  const q = encodeURIComponent(PROMPT);
  box.querySelectorAll('[data-open]').forEach(a => {
    a.href = { claude: `https://claude.ai/new?q=${q}`, chatgpt: `https://chatgpt.com/?q=${q}`, cursor: `cursor://anysphere.cursor-deeplink/prompt?text=${q}` }[a.dataset.open];
    a.addEventListener('click', () => track('open-setup-prompt', { app: a.dataset.open }));
  });
  const text = box.querySelector('.prompt-text'); if (text) text.textContent = PROMPT;
});
document.addEventListener('click', e => document.querySelectorAll('.prompt.open').forEach(b => !b.contains(e.target) && b.classList.remove('open')));

// Hero: type the share on your laptop, send that card back, bring Riya's forward, type the open, loop.
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

// OS and app tabs. OS defaults to the visitor's system and is remembered; every picker on the page stays in sync.
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
  track('copy-command', { command: b.dataset.copy.split('\n')[0] }); // first line names it, e.g. "npm install -g @heyvamz/carry"
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

// Blog: search box + tag filter over the post list.
const posts = [...document.querySelectorAll('.posts a')];
if (posts.length) {
  const box = document.querySelector('.blog-search'), none = document.querySelector('.posts .none');
  let tag = '';
  const filter = () => {
    const q = box.value.trim().toLowerCase();
    let shown = 0;
    posts.forEach(a => {
      const ok = (!tag || a.dataset.tags.split('|').includes(tag)) && (!q || a.textContent.toLowerCase().includes(q));
      a.classList.toggle('hide', !ok); shown += ok;
    });
    none.classList.toggle('hide', shown > 0);
  };
  box.addEventListener('input', filter);
  document.querySelectorAll('.tag-filter button').forEach(b => b.addEventListener('click', () => {
    tag = b.dataset.tag;
    document.querySelectorAll('.tag-filter button').forEach(x => x.classList.toggle('on', x === b));
    filter();
  }));
}
