# ERP Remaining Work

## Immediately Buildable (No External Credentials Needed)

### Journal Entry Creation Page
**Path**: `apps/accounting/app/(protected)/journal-entries/new/page.js`
**What's needed**:
- Multi-line form with dynamic add/remove of debit and credit lines
- Account selector (dropdown from chart-of-accounts API)
- Running total with debit/credit balance indicator
- Submit posts to `/api/journal-entries` (POST route already exists)

### Deal Edit Modal (CRM)
**Path**: `apps/crm/app/(protected)/deals/[id]/page.js`
**What's needed**:
- Edit button → modal to update deal title, value, probability, stage, expected_close_date
- PATCH route already exists and is functional

### Contact Edit Modal (CRM)
**Path**: `apps/crm/app/(protected)/contacts/[id]/page.js`
**What's needed**:
- Edit button → modal to update contact fields
- PATCH route already exists

### Accounting Invoice Lines
**Path**: `apps/accounting/app/(protected)/invoices/page.js` and `bills/page.js`
**What's needed**:
- Line-item sub-form in the create modal (description, qty, unit_price, tax_rate)
- Currently only header fields are created; `acc_invoice_lines` and `acc_bill_lines` tables exist but are not populated from the UI

## Requires Supabase Dashboard Access

### Database Table Creation
Run `supabase/inv-schema-v02-cross-app.sql` in Supabase SQL editor.
Tables needed:
- `acc_chart_of_accounts`
- `acc_journal_entries` + `acc_journal_lines`
- `acc_invoices` + `acc_invoice_lines`
- `acc_bills` + `acc_bill_lines`
- `acc_payments`
- `acc_bank_accounts` + `acc_bank_transactions`
- `acc_expenses`
- `acc_assets`
- `acc_settings`
- `acc_user_roles`
- `crm_contacts`
- `crm_deals`
- `crm_activities`
- `crm_settings`
- `crm_user_roles`

### Row-Level Security (Optional)
RLS is intentionally disabled for all `acc_*` and `crm_*` tables (same pattern as `inv_*`).
All access is via server-side API routes using the service-role key.

## Requires Environment Variables

Both `apps/accounting` and `apps/crm` need these in their respective `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

## Phase 4 — HR & Payroll (Explicitly Deferred)

Per project instructions, HR was left for the next phase. Scope would include:
- Employee records and profiles
- Department / position management
- Attendance and time tracking
- Leave management
- Payroll processing with GOSI deductions
- WPS (Wage Protection System) export for Saudi compliance
- Employee self-service portal

## Phase 5 — Advanced ERP Features (Future)

- Manufacturing/production orders (links to Wood Works, Steel Works, Aluminium Works)
- Bill of Materials (BOM)
- Work-in-progress inventory valuation
- Customer portal for quotation approval and invoice viewing
- Vendor portal for PO acknowledgement
- Mobile-first PWA wrappers for field teams
- ZATCA e-invoicing Phase 2 (QR code + XML submission)
- Power BI / Metabase integration for executive dashboards
