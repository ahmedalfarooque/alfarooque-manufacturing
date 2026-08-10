'use client';

import { GlassButton, GlassModal } from '@/components/glass';

export default function SmartErpWritePermissionWarning({ target, record, action, authorizationPhrase, onAuthorize, onCancel }) {
  return <GlassModal title="SMARTERP WRITE PERMISSION REQUIRED" onClose={onCancel} footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={onCancel}>Cancel</GlassButton><button type="button" onClick={() => onAuthorize?.({ confirmed: true, phrase: authorizationPhrase, target, record, action })} className="rounded-xl border border-red-400 bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-950/30 hover:bg-red-500">Authorize SmartERP change</button></div>}>
    <div className="rounded-xl border-2 border-red-500 bg-red-500/15 p-4 text-red-100" role="alert" aria-live="assertive">
      <p className="font-bold">This action will modify SmartLife / SmartERP.</p>
      <dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-red-300">Target</dt><dd className="font-semibold">{target}</dd></div><div><dt className="text-red-300">Record</dt><dd className="font-semibold">{record}</dd></div><div><dt className="text-red-300">Action</dt><dd className="font-semibold">{action}</dd></div></dl>
      <p className="mt-3 text-xs text-red-200">Authorization applies only to this exact target, record, and action. A normal fix, update, or edit request is not authorization.</p>
    </div>
  </GlassModal>;
}
