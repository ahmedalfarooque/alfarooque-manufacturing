/* ═══════════════════════════════════════════════════════════════════
   Contract payment-schedule engine — PURE functions, no DB, no I/O.
   Used by the payment-schedule editor UI and the contract PDF template.

   A milestone may be driven by percent OR by amount:
     • percent given  → amount = round(total * percent / 100)
     • amount given   → percent = amount / total * 100
     • both given     → both respected as-is (amount wins for the total)
     • neither given  → treated as 0
   The engine never mutates its input; it returns a fully-resolved copy
   plus roll-ups (allocated, remaining, percent totals) and validation
   flags the UI surfaces. All money is rounded to 2 decimals; percentages
   to 3 (matching qt_contract_payments.percent NUMERIC(6,3)).
   ═══════════════════════════════════════════════════════════════════ */

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
export function round3(n) { return Math.round((Number(n) || 0) * 1000) / 1000; }

/* Resolve one milestone against the contract total. */
export function resolveMilestone(m, total) {
  const t = Number(total) || 0;
  const hasAmount = m.amount != null && m.amount !== '';
  const hasPercent = m.percent != null && m.percent !== '';
  let amount, percent;
  if (hasAmount) {
    amount = round2(m.amount);
    percent = t > 0 ? round3((amount / t) * 100) : 0;
  } else if (hasPercent) {
    percent = round3(m.percent);
    amount = round2((t * percent) / 100);
  } else {
    amount = 0; percent = 0;
  }
  return { ...m, amount, percent };
}

/* Resolve the whole schedule + roll-ups. Returns:
   { rows, allocatedAmount, remainingAmount, allocatedPercent, balanced,
     overAllocated } — never throws. */
export function computeSchedule(total, milestones = []) {
  const t = round2(total);
  const rows = (milestones || []).map(m => resolveMilestone(m, t));
  const allocatedAmount = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const allocatedPercent = round3(rows.reduce((s, r) => s + (Number(r.percent) || 0), 0));
  const remainingAmount = round2(t - allocatedAmount);
  return {
    rows,
    total: t,
    allocatedAmount,
    allocatedPercent,
    remainingAmount,
    balanced: Math.abs(remainingAmount) < 0.01,   // fully allocated
    overAllocated: remainingAmount < -0.01,        // milestones exceed total
  };
}

/* Convenience: append a milestone that absorbs the current remaining
   balance (used by the editor's "add remaining" button). */
export function remainingMilestone(total, milestones = [], label = '') {
  const { remainingAmount } = computeSchedule(total, milestones);
  return { label, amount: Math.max(0, remainingAmount), percent: null };
}

/* Validation for save — array of human-readable problems (empty = ok). */
export function validateSchedule(total, milestones = [], t = k => k) {
  const problems = [];
  const s = computeSchedule(total, milestones);
  if (s.overAllocated) problems.push(t('contract.pay.errOver'));
  (milestones || []).forEach((m, i) => {
    const hasAmount = m.amount != null && m.amount !== '';
    const hasPercent = m.percent != null && m.percent !== '';
    if (hasPercent && (Number(m.percent) < 0 || Number(m.percent) > 100)) {
      problems.push(t('contract.pay.errPct') + ' #' + (i + 1));
    }
    if (hasAmount && Number(m.amount) < 0) {
      problems.push(t('contract.pay.errNeg') + ' #' + (i + 1));
    }
  });
  return problems;
}
