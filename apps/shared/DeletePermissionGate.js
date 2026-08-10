'use client';

import { useEffect } from 'react';

const DELETE_WORDS = ['delete', 'remove', 'deactivate', 'trash', '🗑', 'حذف', 'إزالة', 'تعطيل'];

function isDeleteControl(element) {
  if (element.dataset.allowWithoutDeletePermission === 'true') return false;
  if (element.dataset.deleteControl === 'true') return true;
  const signature = [
    element.getAttribute('title'), element.getAttribute('aria-label'),
    element.textContent, element.innerHTML,
  ].filter(Boolean).join(' ').toLowerCase();
  return DELETE_WORDS.some(word => signature.includes(word));
}

export default function DeletePermissionGate() {
  useEffect(() => {
    let observer;
    let cancelled = false;
    fetch('/api/app-permissions', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (cancelled || data?.can_delete) return;
        const hideDeleteControls = root => {
          const candidates = root.querySelectorAll ? root.querySelectorAll('button, a, [role="button"]') : [];
          for (const element of candidates) {
            if (isDeleteControl(element)) {
              element.hidden = true;
              element.setAttribute('aria-hidden', 'true');
              element.dataset.deletePermissionHidden = 'true';
            }
          }
        };
        hideDeleteControls(document);
        observer = new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches?.('button, a, [role="button"]') && isDeleteControl(node)) node.hidden = true;
              hideDeleteControls(node);
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      })
      .catch(() => {});
    return () => { cancelled = true; observer?.disconnect(); };
  }, []);
  return null;
}
