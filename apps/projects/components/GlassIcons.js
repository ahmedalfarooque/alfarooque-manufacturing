'use client';

/* AL FAROOQUE glass icon system — React port of /js/glass-icons.js.
   <GlassIconsLoader /> (default export, mounted once in app/layout.js)
   fetches /glass-icons.svg a single time (sessionStorage-cached) and
   injects it inline at the start of <body>, so every
   <GlassIcon name="…"/> <use> resolves same-document — required for the
   sprite's gradients/filters and CSS-variable tints to apply.
   Icon-only visual layer: no data, auth, or routing concerns. */

import { useEffect } from 'react';

const KEY = 'af-glass-icons-v2';
const URL = '/glass-icons.svg';

function inject(svgText) {
  if (document.getElementById('giSpriteRoot')) {
    document.documentElement.classList.add('gi-ready');
    return;
  }
  const holder = document.createElement('div');
  holder.id = 'giSpriteRoot';
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
  holder.innerHTML = svgText;
  document.body.insertBefore(holder, document.body.firstChild);
  document.documentElement.classList.add('gi-ready');
}

export default function GlassIconsLoader() {
  useEffect(() => {
    let cached = null;
    try { cached = sessionStorage.getItem(KEY); } catch (_) {}
    if (cached) { inject(cached); return; }
    fetch(URL)
      .then(r => (r.ok ? r.text() : null))
      .then(text => {
        if (!text || text.indexOf('<svg') === -1) return;
        try { sessionStorage.setItem(KEY, text); } catch (_) {}
        inject(text);
      })
      .catch(() => { /* icons degrade to empty slots; labels remain */ });
  }, []);
  return null;
}

export function GlassIcon({ name, size, className }) {
  return (
    <svg
      className={'gicon' + (className ? ' ' + className : '')}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <use href={'#gi-' + name} />
    </svg>
  );
}
