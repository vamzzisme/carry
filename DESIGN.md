# Design

carry's site follows the VXMZ Studio standard (`../VXMZ_STUDIO_STANDARD.md`, sections 1b and 1c) with carry's own accent.
It is the template the other product sites (Lobe, DClutter, Drapr, Manga Reader) are being moved onto.

## Brand
- Product name in lowercase: **carry**. Command: `carry`. npm: `@heyvamz/carry`.
- Positioning: "AirDrop for AI chats and projects". Serverless in the plain sense: no carry server, no account, everything
  travels through the user's own Google Drive. Second hook: "Out of tokens? Keep coding."
- VXMZ appears only in the footer ("Built by @heyvxmz", "A VXMZ Product"). No opening curtain (that is for the studio site),
  no studio eyebrow in the hero, no VXMZ text in the sidebar.
- Voice: plain, concrete, no em dashes, no hype words (seamless, unlock, elevate).

## Colour (clay: warm, earthy, never neon; light mode only)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#fbfaf7` warm white | page background |
| `--soft` / `--soft-2` | `#f1efe8` / `#e8e5dc` | secondary buttons, inline code, cards, hover |
| `--ink` | `#11120f` | text |
| `--muted` | `#60635b` | secondary text, labels, sidebar links |
| `--line` | `rgba(17,18,15,.11)` | borders and dividers |
| `--accent` | `#c2674b` Clay | primary button, logo, active marks |
| `--accent-ink` | `#8f3d27` deep clay | links and italic headings on the light background |
| `--deep` / `--deep-2` | `#2a1a14` / `#37231b` clay brown | terminals and code blocks |
| prompt clay | `#cf7a5e` | `$` prompts on the dark terminals |
| primary button text | `#fffaf5` | text on the clay button |
| window dots | `#ff5f57` `#febc2e` `#28c840` | every terminal mockup |
| name highlight | clay at 24% | soft highlighter stroke behind "carry" in running text |

## Type
- `--display`: Boska (Fontshare), falling back to Bodoni Moda and Georgia. Logo word, italic accents in headings.
- `--body`: Inter (Google Fonts). Body text, headings, the footer.
- `--mono`: IBM Plex Mono (Google Fonts). Code, terminals, buttons and small uppercase labels only, never the footer.

## Layout
- Docs-style shell: sticky left sidebar (232px) plus one reading column (about 680px), max width 1160px.
- Sidebar: logo + "carry" at the top, nav (Home, Docs, Blog, Changelog, GitHub) a fixed 40px below, then the
  "On this page" title and its list (built from the page's `h2[id]` and `h3[id][data-toc]`, highlighted while scrolling).
  Brand, nav and that title sit at the same position on every page; only the section list scrolls.
- Under 900px the sidebar becomes a top bar with a menu button.

## Components
- Logo: the clay C-and-arrow glyph, inline SVG. Draws itself in once per visit (the C strokes in, the arrow slides in);
  the arrow nudges on hover. Off with `prefers-reduced-motion`.
- Buttons: 2px radius, small uppercase mono text. Primary (clay fill), secondary (soft fill), text link; press `scale(.98)`.
- "Copy setup prompt" split button: copies one line pointing an AI at `/setup.md`; the arrow opens it in Claude, ChatGPT or Cursor.
- "Works with" row: real app icons (`site/icons/`, MIT, from `@lobehub/icons-static-svg`), names in `alt`/`title`.
- Tabs: OS (macOS / Windows / Linux, auto-detected, remembered, synced across the page) and app (Claude Desktop / Codex / Cursor).
- Hero: two stacked terminals. "your laptop" types `carry list` + `carry share`, slides back, "riya's laptop" types
  `carry open`, loops. Static markup is the fallback for no JS and reduced motion.
- Product name in running text: `main.js` wraps "carry" in `.pname` (highlighter stroke). Skips code, commands, buttons,
  labels, the footer, names like `carry-si.vercel.app`, and anything marked `data-plain`.
- Blog: post cards with tags, a search box and tag filters. No numbering on cards.
- FAQ: `<details>`; the question text sits in one `<span>` so the flex row doesn't split it.
- Footer: Inter, normal case. Three columns (Product, Open source, Studio), then "Built by @heyvxmz · carry vN · © year"
  and "A VXMZ Product".

## Rules learned the hard way
- Version-tag CSS and JS (`style.css?v=N`, `main.js?v=N`) and bump N on every change, or browsers keep old files.
- Check every page at 390px wide with no horizontal scroll.
- A one-shot CSS animation left on an element replays when a hover animation ends: remove the intro class once it has played.
