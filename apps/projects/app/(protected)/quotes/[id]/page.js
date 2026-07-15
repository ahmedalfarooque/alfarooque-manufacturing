'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { QUOTE_STATUS_BADGE } from '../page';
import { GlassButton } from '@/components/glass';

const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [replies, setReplies] = useState(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    fetch('/api/quotes/' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setQuote(d.quote); setStatus(d.quote.status); setNotes(d.quote.admin_notes || ''); })
      .catch(() => setError(t('common.genericError')));
    fetch('/api/quotes?replies=1&quoteId=' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setReplies(d.replies))
      .catch(() => setReplies([]));
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    const res = await fetch('/api/quotes/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status, admin_notes: notes }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { alert(t('oq.saved')); load(); } else alert(t('common.genericError'));
  }

  async function deleteQuote() {
    if (!confirm(t('oq.confirmDeleteQuote'))) return;
    setBusy(true);
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) window.location.href = '/quotes';
  }

  async function convertToOrder() {
    setBusy(true);
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'convert-to-order', id }),
    }).catch(() => null);
    setBusy(false);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res && res.ok) { alert(t('oq.converted')); load(); if (d.order?.id) window.location.href = '/orders/' + d.order.id; }
    else alert(d.error || t('common.genericError'));
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const kept = files.filter(f => {
      if (f.size > 5 * 1024 * 1024) { alert(f.name + ' is too large (max 5MB).'); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...kept]);
  }
  function removeAttachment(i) { setAttachments(prev => prev.filter((_, idx) => idx !== i)); }

  async function sendReply() {
    if (!subject.trim() || !message.trim()) return alert(t('oq.subjectMessageRequired'));
    setSending(true);
    try {
      const encoded = await Promise.all(attachments.map(async f => ({
        name: f.name, mime: f.type || 'application/octet-stream', dataBase64: await fileToBase64(f),
      })));
      const res = await fetch('/api/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ action: 'reply', id, subject, message, attachments: encoded }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || t('common.genericError')); return; }
      alert(t('oq.emailSent'));
      setReplyOpen(false); setSubject(''); setMessage(''); setAttachments([]);
      load();
    } finally {
      setSending(false);
    }
  }

  if (error) return <Shell active="/quotes"><div className="text-red-500">{error}</div></Shell>;
  if (!quote) return <Shell active="/quotes"><div className="text-[#7C9296]">{t('common.loading')}</div></Shell>;

  return (
    <Shell active="/quotes">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">{quote.name || quote.email || '—'}</h2>
          <span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (QUOTE_STATUS_BADGE[quote.status] || '')}>{trEnum(t, 'status', quote.status)}</span>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">{t('common.email')}</span><span dir="ltr">{quote.email || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Phone</span><span dir="ltr">{quote.phone || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('oq.col.product')}</span><span>{quote.product || '—'}</span></div>
          {quote.message && <div><span className="text-slate-400 block mb-1">Message</span><p>{quote.message}</p></div>}
        </div>

        {!replyOpen ? (
          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-3 text-sm">
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.col.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2">
                {QUOTE_STATUSES.map(s => <option key={s} value={s}>{trEnum(t, 'status', s)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.adminNotes')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GlassButton variant="primary" className="text-sm px-3 py-2" disabled={busy} onClick={save}>{t('oq.save')}</GlassButton>
              {!quote.order_id && (
                <GlassButton variant="secondary" className="text-sm px-3 py-2" disabled={busy} onClick={convertToOrder}>{t('oq.convertToOrder')}</GlassButton>
              )}
              {quote.email && (
                <GlassButton variant="secondary" className="text-sm px-3 py-2" disabled={busy} onClick={() => setReplyOpen(true)}>{t('oq.replyToCustomer')}</GlassButton>
              )}
              <GlassButton variant="danger" className="text-sm px-3 py-2" disabled={busy} onClick={deleteQuote}>{t('oq.delete')}</GlassButton>
              <a href="/quotes" className="text-sm text-slate-400 hover:underline ms-auto">‹ {t('oq.quotesTitle')}</a>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-3 text-sm">
            <h3 className="font-medium">{t('oq.replyToCustomer')}</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.to')}</label>
              <input value={quote.email} disabled className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 opacity-60" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.subject')}</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.message')}</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">{t('oq.attachments')}</label>
              <input type="file" multiple onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              {attachments.length === 0 ? (
                <p className="text-slate-400 text-xs mt-2">{t('oq.noAttachments')}</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{f.name} ({Math.round(f.size / 1024)} KB)</span>
                      <button onClick={() => removeAttachment(i)} className="text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <GlassButton variant="primary" className="text-sm px-3 py-2" disabled={sending} onClick={sendReply}>{sending ? t('oq.sending') : t('oq.send')}</GlassButton>
              <GlassButton variant="secondary" className="text-sm px-3 py-2" disabled={sending} onClick={() => setReplyOpen(false)}>{t('oq.cancel')}</GlassButton>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 text-sm">
          <h3 className="font-medium mb-2">{t('oq.communicationHistory')}</h3>
          {replies === null ? (
            <p className="text-slate-400">{t('common.loading')}</p>
          ) : replies.length === 0 ? (
            <p className="text-slate-400">{t('oq.noRepliesYet')}</p>
          ) : replies.map(r => (
            <div key={r.id} className="py-2 border-b last:border-0 border-black/5 dark:border-white/5">
              <div className="flex justify-between items-center gap-2">
                <strong>{r.subject}</strong>
                <span className={'px-2 py-0.5 rounded-full text-xs ' + (r.status === 'failed' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600')}>
                  {r.status === 'failed' ? t('oq.replyStatusFailed') : t('oq.replyStatusSent')}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-1">{r.admin_name} — {new Date(r.created_at).toLocaleString()}</div>
              <p>{r.message}</p>
              {r.attachments?.length > 0 && (
                <div className="text-xs text-slate-400 mt-1">📎 {r.attachments.map(a => a.name).join(', ')}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}