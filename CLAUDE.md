# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Premium corporate website for **Alfarouqi Manufacturing** (IAAE - Alfarouqi Industries), a Saudi company with three manufacturing divisions: Wood Works, Steel Works, and Aluminium Works. Pure static site — no build tools, no npm packages, no frameworks.

## Running Locally

No build step required. Open `index.html` directly in a browser, or use a local dev server to avoid asset path issues:

```bash
python -m http.server 3004
# or
npx serve . -p 3004
```

## Architecture

### Page Structure

8 HTML files in 4 bilingual pairs — every page exists in both English and Arabic:

| Section | English | Arabic |
|---------|---------|--------|
| Home | `index.html` | `index-ar.html` |
| About | `pages/about.html` | `pages/about-ar.html` |
| Services | `pages/services.html` | `pages/services-ar.html` |
| Gallery | `pages/gallery.html` | `pages/gallery-ar.html` |
| Contact | `pages/contact.html` | `pages/contact-ar.html` |

When changing content, always update **both** the English and Arabic versions.

### CSS Architecture (7 files, ~100KB total)

Files are layered and must all be included in this order:

1. **`css/design-system.css`** — CSS custom properties for all brand tokens (colors, fonts, spacing, shadows). Change values here to propagate across the entire site.
2. **`css/main.css`** — Reset, layout utilities, animations, and most page section styles.
3. **`css/components.css`** — Reusable component styles (cards, buttons, gallery, lightbox, hero).
4. **`css/nav.css`** — Fixed navigation and mobile burger menu.
5. **`css/background.css`** — Animated orbs, particles, grid, and geometric elements.
6. **`css/themes.css`** — Dark/light theme tokens and component-specific theme overrides.
7. **`css/rtl.css`** — Arabic RTL direction overrides and Arabic font assignments.

### JavaScript (3 files)

- **`js/main.js`** — Core interactions: scroll reveal (IntersectionObserver), animated counters, gallery filters and lightbox, contact form simulation, preloader, cursor glow, card tilt, magnetic buttons.
- **`js/theme-switcher.js`** — Dark/light toggle. Persists in `localStorage("theme")`. Defaults to dark. Includes an early inline script in each `<head>` to prevent flash on load.
- **`js/language-switcher.js`** — EN/AR toggle. Persists in `localStorage("language")`. Redirects between paired pages. Detects current page language via `document.documentElement.lang`.

## Bilingual & RTL System

- **English pages**: `<html lang="en">` — LTR, Inter/Syne fonts.
- **Arabic pages**: `<html lang="ar" dir="rtl">` — RTL, Cairo/Tajawal fonts.
- All RTL overrides live in `css/rtl.css` using `html[dir="rtl"]` selectors.
- Arabic fonts are redefined in `rtl.css` by overriding `--font-display` and `--font-body` custom properties.
- The language switcher maps paired pages and auto-redirects if the saved preference doesn't match the current page's language.

## Theme System

- **Default**: Dark theme (always, regardless of system preference).
- Dark tokens are defined at `:root` in `css/themes.css`; light overrides use `:is(html.light, body.light)`.
- Each HTML file's `<head>` contains a small inline script before CSS loads to apply the saved theme class before render, preventing flash.
- Toggle adds/removes `.light` on both `<html>` and `<body>`.

## Key Conventions

- **Scroll reveal**: Add class `reveal` to any element to animate it in on scroll. Use `delay-1`, `delay-2`, `delay-3` for staggered timing.
- **Glass cards**: Use `.glass` class for glassmorphism card style (defined in `design-system.css`).
- **Buttons**: `.btn.btn-primary` (teal fill), `.btn.btn-ghost` (outline), `.btn.btn-outline` (bordered).
- **Magnetic buttons**: Add `data-mag` attribute to enable pointer-following effect.
- **Card tilt**: Add `data-tilt` attribute to enable 3D tilt on mouse move.
- **Gallery filters**: Button `data-filter="wood|steel|aluminium|factory|projects|all"` targets `.gal-item[data-cat="..."]` elements.
- **Counters**: Add `data-target="<number>"` and `data-suffix="<string>"` to `.stat-num` elements.

## Images

- Gallery images: `assets/images/gallery/`
- Machine/equipment images: `assets/images/machines/`
- Company/team images: `assets/images/` root and subdirectories
- Images are lazy-loaded via `loading="lazy"` and the IntersectionObserver in `main.js`.

## Contact Form

The contact form in `pages/contact.html` currently simulates submission (1400ms delay + success state). To wire up a real backend, replace the `setTimeout` block in `main.js` (`/* ═══ CONTACT FORM ═══ */` section) with a `fetch()` call to EmailJS, Formspree, or a custom API endpoint.
