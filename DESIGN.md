# Design

carry's site follows the VXMZ Studio standard (`../VXMZ_STUDIO_STANDARD.md`) with carry's own accent.

## Brand
- Product name in lowercase: **carry**. Command: `carry`. npm: `@heyvamz/carry`.
- VXMZ appears only in the opening curtain ("A VXMZ PRODUCT") and the footer ("built by @heyvxmz", "A VXMZ PRODUCT").
  No studio eyebrow in the hero, no "by vxmz" in the navbar.
- Voice: plain, concrete, no em dashes, no hype words (seamless, unlock, elevate). Lead with the problem: "Out of tokens? Keep coding."

## Colour (warm, earthy, never neon)
| Token | Value | Use |
|---|---|---|
| `--accent` | `#e9a23b` Marigold | buttons, prompts, icon, dark-mode links and italic headings |
| `--accent-ink` | `#9a5b12` burnt amber | links and italic headings on paper (light mode) |
| `--deep` / `--deep-2` | `#241c13` / `#30261a` earth brown | privacy band, terminals, code blocks |
| `--ink` / `--paper` | `#11120f` / `#f1efe8` | studio base, shared by all VXMZ products |
| window dots | `#ff5f57` `#febc2e` `#28c840` | every terminal mockup |

## Type
Boska (display, from Fontshare), Inter (body), IBM Plex Mono (terminals and code).

## Components
- Pill navbar: icon + "carry", numbered links (01 How it works … 04 FAQ), one primary button; drawer under 768px.
- Buttons: primary (filled marigold), secondary (outline), text link; press feedback `scale(.98)`.
- Tabs: OS (macOS / Windows / Linux, auto-detected, remembered, synced across the page) and app (Claude Desktop / Codex / Cursor).
- Hero: two stacked terminals. "your laptop" types `carry list` + `carry share`, slides back, "riya's laptop" types `carry open`, loops.
  Static markup is the fallback for no JS and `prefers-reduced-motion`.

## Rules learned the hard way
- Version-tag CSS, JS and the icon (`style.css?v=N`) and bump N on every change, or browsers keep old files.
- Check every page at 390px wide, light and dark, with no horizontal scroll.
