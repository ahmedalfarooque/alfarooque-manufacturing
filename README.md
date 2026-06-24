# AL FAROOQUE Manufacturing Website v5.0
## Glassmorphism 4.0 | Luxury Industrial Design System

---

## 📁 Project Structure

```
AL FAROOQUE-website/
├── index.html              ← Home page (open directly in browser)
├── pages/
│   ├── about.html          ← About + All Certifications
│   ├── services.html       ← Wood / Steel / Aluminium Works
│   ├── gallery.html        ← Masonry gallery + lightbox + filters
│   └── contact.html        ← Contact form + Request a Quote
├── css/
│   ├── design-system.css   ← Brand tokens, reset, utilities, buttons
│   ├── background.css      ← Animated orbs, grid, particles, rays
│   ├── nav.css             ← Sticky navigation + mobile menu
│   └── components.css      ← All page components (hero, cards, etc.)
├── js/
│   └── main.js             ← Scroll reveal, counters, gallery, form
└── assets/
    ├── images/
    │   ├── gallery/        ← Add your gallery photos here
    │   ├── machines/       ← Add machine photos here (filename = machine name)
    │   └── certs/          ← Add certificate scans here
    └── logo-symbol.html    ← IAA SVG logo reference
```

---

## 🚀 How to Use (No build step needed)

This is a **pure HTML/CSS/JS website** — no Node.js, no npm required.

**Option A — Open directly in browser:**
Double-click `index.html` — works offline, no server needed.

**Option B — Local dev server (recommended for file paths):**
```bash
# Python (built-in)
python -m http.server 3004

# OR Node.js
npx serve . -p 3004
```
Then open: http://localhost:3004

---

## 🖼️ Adding Your Images

### Gallery Images
1. Copy photos to `assets/images/gallery/`
2. Open `pages/gallery.html`
3. Replace each `<div class="gallery-placeholder">` block with:
```html
<img src="../assets/images/gallery/YOUR_FILE.jpg" alt="Wood Works Project">
```
4. Set `data-category` on the parent `.gallery-item` to one of:
   `wood` | `steel` | `aluminium` | `factory` | `projects`

### Machine Images
1. Copy to `assets/images/machines/`
2. Open `pages/services.html`
3. Replace the machine-img placeholder divs with `<img>` tags
4. The machine name = the filename (remove extension)

### Factory Hero Image
- In `index.html` showcase card: replace the SVG watermark with `<img src="assets/images/factory-hero.jpg">`
- In `pages/about.html` about-visual: replace the SVG with your factory photo

---

## 📋 Fill In Real Company Data

Search for these placeholders and replace with real data from your company profile PDFs:

| Placeholder | Replace With |
|-------------|-------------|
| `+966 (0) XXX XXXX` | Real phone number |
| `info@alfarooque.com` | Real email |
| `Est. Since 2000` | Real establishment year |
| `20+` years counter | Correct number |
| Certificate `href="#"` links | Real PDF links or modal |
| `Jeddah, Saudi Arabia` address | Full street address |

---

## 🎨 Design System Quick Reference

### Brand Colors
```css
--teal-600: #0891a8   /* Primary brand teal (from IAA logo) */
--teal-400: #22c4de   /* Accent / highlights */
--grey-900: #111418   /* Background */
--grey-500: #6b7280   /* Body text / secondary */
```

### Glass Utility Classes
```css
.glass-card          /* Basic glass card */
.glass-card-mid      /* More opaque glass */
.glass-card-teal     /* Teal-tinted glass */
.sweep-wrap          /* Adds hover light sweep animation */
```

### Button Classes
```css
.btn .btn-primary      /* Solid teal CTA */
.btn .btn-ghost        /* Ghost/outline */
.btn .btn-teal-outline /* Teal outlined */
```

### Animation Classes
```css
.fade-up             /* Scroll-triggered entrance */
.fade-up.delay-1     /* +0.10s delay */
.fade-up.delay-2     /* +0.20s delay */
.fade-up.delay-3     /* +0.30s delay */
```
Add `data-magnetic` to buttons for subtle magnetic hover effect.
Add `data-tilt` to cards for 3D tilt on hover.
Add `data-count="20" data-suffix="+"` to numbers for animated counters.

---

## 🔗 Contact Form

The form in `contact.html` is ready to wire to a backend. Options:
- **EmailJS** — add their SDK and replace the simulate delay in `main.js`
- **Formspree** — change `action=""` on the form tag
- **Custom API** — replace the `fetch` simulation in `initContactForm()`

---

## 📦 To Convert to Next.js

If integrating into your existing Next.js project:
1. Move CSS files → `styles/` directory
2. Convert each HTML page → `app/page.tsx` or `pages/*.tsx`
3. Move JS → React hooks (`useEffect` + `useRef`)
4. Replace inline SVG logo with `<Image src="/IAA_LOGO_NEW_2_no_bg.png">`
5. Use `next/font` for Syne + Inter

---

## ✅ Checklist Before Launch

- [ ] Replace all placeholder phone/email/address
- [ ] Add real gallery images (gallery/)
- [ ] Add real machine images (machines/)
- [ ] Add real factory photo to hero
- [ ] Link certificate PDFs in About page
- [ ] Wire contact form to real email service
- [ ] Add Google Analytics / Tag Manager
- [ ] Add favicon.ico
- [ ] Test on mobile
- [ ] Check all internal links work

---

*AL FAROOQUE Manufacturing v5.0 — Glassmorphism 4.0 Design System*
*Brand: IAA / AL FAROOQUE Industries (IAAE) — Jeddah, Saudi Arabia*
