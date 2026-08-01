'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function BankingPage() {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ currency: 'SAR' });
  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ transaction_type: 'credit' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const { data: bankData, refresh: refreshAccounts } = useLiveData('/api/banking', 0);
  const accounts = bankData?.accounts || [];

  const txParams = new URLSearchParams({ page: txPage, pageSize });
  if (selectedAccount) txParams.set('account_id', selectedAccount);
  const { data: txData, refresh: refreshTx } = useLiveData(`/api/banking/transactions?${txParams}`, 15000);
  const transactions = txData?.transactions || [];

  async function createAccount() {
    setSaving(true);
    try {
      const res = await fetch('/api/banking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accountForm) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Bank account created', 'success');
      setShowAccountForm(false);
      setAccountForm({ currency: 'SAR' });
      refreshAccounts();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function createTx() {
    setSaving(true);
    try {
      const payload = { ...txForm, bank_account_id: selectedAccount || txForm.bank_account_id };
      const res = await fetch('/api/banking/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Transaction recorded', 'success');
      setShowTxForm(false);
      setTxForm({ transaction_type: 'credit' });
      refreshTx();
      refreshAccounts();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Banking</h1>
        <div className="flex gap-2">
          <GlassButton variant="secondary" onClick={() => setShowAccountForm(true)}>+ Bank Account</GlassButton>
          <GlassButton onClick={() => setShowTxForm(true)}>+ Transaction</GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map(a => (
          <GlassCard key={a.id} className={`cursor-pointer transition-all ${selectedAccount === a.id ? 'ring-2 ring-cyan-400' : ''}`}
            onClick={() => setSelectedAccount(selectedAccount === a.id ? '' : a.id)}>
            <p className="text-xs text-slate-400">{a.bank_name || 'Bank'}</p>
            <p className="text-white font-semibold">{a.name}</p>
            <p className="text-lg font-bold text-cyan-400 mt-1">SAR {fmt(a.current_balance)}</p>
            <GlassBadge tone={a.is_active ? 'success' : 'neutral'}>{a.currency}</GlassBadge>
          </GlassCard>
        ))}
        {!accounts.length && (
          <div className="col-span-4 text-center text-slate-500 py-8">No bank accounts. Add one to get started.</div>
        )}
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">
            {selectedAccount ? `Transactions — ${accounts.find(a => a.id === selectedAccount)?.name}` : 'All Transactions'}
          </h3>
          {selectedAccount && <GlassButton variant="secondary" size="sm" onClick={() => setSelectedAccount('')}>Show All</GlassButton>}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Date</GlassTh>
              <GlassTh>Type</GlassTh>
              <GlassTh>Account</GlassTh>
              <GlassTh>Description</GlassTh>
              <GlassTh>Amount</GlassTh>
              <GlassTh>Reference</GlassTh>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd>{t.transaction_date}</GlassTd>
                <GlassTd><GlassBadge tone={t.transaction_type === 'credit' ? 'success' : 'error'}>{t.transaction_type}</GlassBadge></GlassTd>
                <GlassTd className="text-slate-400">{t.acc_bank_accounts?.name || '—'}</GlassTd>
                <GlassTd>{t.description || '—'}</GlassTd>
                <GlassTd className={`font-medium ${t.transaction_type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.transaction_type === 'credit' ? '+' : '-'}SAR {fmt(t.amount)}
                </GlassTd>
                <GlassTd className="font-mono text-xs text-slate-400">{t.reference || '—'}</GlassTd>
              </tr>
            ))}
            {!transactions.length && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No transactions found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={txPage} pageSize={pageSize} total={txData?.total || 0} onPage={setTxPage} />
      </GlassCard>

      {showAccountForm && (
        <GlassModal title="New Bank Account" onClose={() => setShowAccountForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowAccountForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createAccount} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Account Name" required>
              <GlassInput value={accountForm.name || ''} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Bank Name">
              <GlassInput value={accountForm.bank_name || ''} onChange={e => setAccountForm(f => ({ ...f, bank_name: e.target.value }))} />
            </GlassField>
            <GlassField label="Account Number">
              <GlassInput value={accountForm.account_number || ''} onChange={e => setAccountForm(f => ({ ...f, account_number: e.target.value }))} />
            </GlassField>
            <GlassField label="IBAN">
              <GlassInput value={accountForm.iban || ''} onChange={e => setAccountForm(f => ({ ...f, iban: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={accountForm.currency || 'SAR'} onChange={e => setAccountForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Opening Balance">
              <GlassInput type="number" step="0.01" value={accountForm.current_balance || ''} onChange={e => setAccountForm(f => ({ ...f, current_balance: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}

      {showTxForm && (
        <GlassModal title="New Transaction" onClose={() => setShowTxForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowTxForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createTx} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Bank Account" required>
              <GlassSelect value={txForm.bank_account_id || selectedAccount || ''} onChange={e => setTxForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Type" required>
              <GlassSelect value={txForm.transaction_type || 'credit'} onChange={e => setTxForm(f => ({ ...f, transaction_type: e.target.value }))}>
                <option value="credit">Credit (money in)</option>
                <option value="debit">Debit (money out)</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Date">
              <GlassInput type="date" value={txForm.transaction_date || ''} onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Amount" required>
              <GlassInput type="number" step="0.01" value={txForm.amount || ''} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
            </GlassField>
            <GlassField label="Description">
              <GlassInput value={txForm.description || ''} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} />
            </GlassField>
            <GlassField label="Reference">
              <GlassInput value={txForm.reference || ''} onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
