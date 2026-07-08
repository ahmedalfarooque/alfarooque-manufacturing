/* ═══════════════════════════════════════════════════════════
   AL FAROOQUE — Division mini-gallery loader (Services page)
   Auto-scans assets/images/<Division>/ via /api/division-images —
   no hardcoded filenames. Drop a new photo in the folder and it
   appears on next load with zero code changes.
   ═══════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grids = document.querySelectorAll('[data-division-gallery]');
  if (!grids.length) return;

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbClose = document.getElementById('lb-close');

  function openLightbox(src, alt) {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt || '';
    lb.classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lb) lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  const IS_AR = document.documentElement.lang === 'ar';
  const LABELS = {
    steel: IS_AR ? 'صورة مشروع الأعمال الحديدية' : 'Steel project photo',
    aluminium: IS_AR ? 'صورة مشروع الأعمال الألومنيوم' : 'Aluminium project photo',
  };

  const revealObserver = REDUCED_MOTION ? null : new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  grids.forEach(grid => {
    const division = grid.dataset.divisionGallery;
    const catAttr = division.replace('-works', '');
    const label = LABELS[catAttr] || (catAttr.charAt(0).toUpperCase() + catAttr.slice(1));

    fetch('/api/division-images?division=' + encodeURIComponent(division))
      .then(r => r.ok ? r.json() : { images: [] })
      .then(data => {
        const images = data.images || [];
        if (!images.length) return;

        images.forEach((src, i) => {
          const item = document.createElement('div');
          item.className = 'gal-item division-gal-item';
          item.dataset.cat = catAttr;
          if (!REDUCED_MOTION) item.classList.add('division-gal-item--pending');

          const img = document.createElement('img');
          img.src = src;
          img.alt = label + ' ' + (i + 1);
          img.loading = 'lazy';
          img.decoding = 'async';

          const overlay = document.createElement('div');
          overlay.className = 'gal-overlay';

          item.appendChild(img);
          item.appendChild(overlay);
          item.addEventListener('click', () => openLightbox(src, img.alt));

          grid.appendChild(item);
          if (revealObserver) revealObserver.observe(item);
        });
      })
      .catch(err => console.error('[division-gallery] failed to load "' + division + '":', err));
  });
})();
