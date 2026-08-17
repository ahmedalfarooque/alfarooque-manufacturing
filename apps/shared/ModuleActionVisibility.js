'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import registry from './permissionRegistry';

const { moduleFromPath } = registry;

/* Arabic equivalents of the same verbs — without these, a page rendered
   in Arabic has no English words for this heuristic to match, so the
   text-based fallback silently never hides anything for Arabic UI (found
   during the interior-page parity audit). Server-side authorization is
   unaffected either way (see the function comment below); this only
   restores the same UI-hint behavior Arabic users get as English users. */
function inferredAction(element, pathname) {
  const explicit = element.getAttribute('data-permission-action');
  if (['add', 'edit', 'delete'].includes(explicit)) return explicit;
  const href = element.getAttribute('href') || '';
  if (/(^|\/)new(?:[/?#]|$)/i.test(href)) return 'add';
  if (/(^|\/)edit(?:[/?#]|$)/i.test(href)) return 'edit';
  const text = String(element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (/^(delete|remove)(\s|$)/.test(text) || /^(حذف|إزالة|ازالة)(\s|$)/.test(text)) return 'delete';
  if (/^(edit|update)(\s|$)/.test(text) || text === 'save changes' || /^(تعديل|تحديث)(\s|$)/.test(text)) return 'edit';
  if (text === 'save' || text === 'حفظ') return /\/new(?:\/|$)/.test(pathname) ? 'add' : 'edit';
  if (/^(\+\s*)?(add|new|create|duplicate|import)(\s|$)/.test(text) || /^(\+\s*)?(إضافة|اضافة|إنشاء|انشاء|تكرار|استيراد)(\s|$)/.test(text)) return 'add';
  return null;
}

function setPermissionHidden(element, hidden) {
  if (hidden) {
    if (!element.hasAttribute('data-permission-display')) element.setAttribute('data-permission-display', element.style.display || '');
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('aria-hidden', 'true');
  } else if (element.hasAttribute('data-permission-display')) {
    element.style.display = element.getAttribute('data-permission-display') || '';
    element.removeAttribute('data-permission-display');
    element.removeAttribute('aria-hidden');
  }
}

// Mirrors live server permissions in the UI. This is convenience only;
// server route authorization remains the security boundary.
export default function ModuleActionVisibility() {
  const pathname = usePathname();
  useEffect(() => {
    let disposed = false;
    let observer;
    let current;
    const apply = () => {
      if (!current || disposed) return;
      const { app_id: appId, modules = [] } = current;
      const currentId = moduleFromPath(appId, pathname);
      const currentRow = modules.find(row => row.id === currentId);
      const permission = currentRow?.permission || {};
      for (const element of document.querySelectorAll('a,button,[data-permission-action]')) {
        let hidden = false;
        const href = element.getAttribute('href');
        if (href && href.startsWith('/')) {
          const targetId = moduleFromPath(appId, href);
          const target = modules.find(row => row.id === targetId);
          if (target?.permission && !target.permission.view) hidden = true;
        }
        const action = inferredAction(element, pathname);
        if (action && currentRow && !permission[action]) hidden = true;
        setPermissionHidden(element, hidden);
      }
    };
    fetch('/api/my-permissions', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data || disposed) return;
        current = data;
        apply();
        observer = new MutationObserver(apply);
        observer.observe(document.body, { childList: true, subtree: true });
      }).catch(() => {});
    const preventUnauthorized = event => {
      const element = event.target?.closest?.('a,button,[data-permission-action]');
      if (element?.getAttribute('aria-hidden') === 'true') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', preventUnauthorized, true);
    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('click', preventUnauthorized, true);
    };
  }, [pathname]);
  return null;
}
