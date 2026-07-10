# Quotation System Master Specification
## Al Farooque — Enterprise Quotation & Cost Estimation System
**Application:** quotation.alfarooque.com
**Version:** 1.0 (Architecture & Design Phase — no code)
**Date:** 2026-07-09
**Prepared by:** Senior Business Analyst / ERP Consultant / UI-UX Designer / Database Architect / Software Architect / Product Manager (Claude)

---

## Table of Contents

1. Executive Summary & Analysis of Provided Materials
2. Business Requirement Document (BRD)
3. Software Requirement Specification (SRS)
4. Business Workflow
5. User Flows
6. Screen Flow & Navigation Structure
7. UI Wireframes (every screen)
8. Dashboard Design
9. Costing Engine Specification (formulas & rules)
10. Database ER Diagram
11. PostgreSQL Table Design (full schema)
12. API Design
13. User Roles & Permissions
14. Folder Structure
15. Component Architecture
16. State Management Strategy
17. Security Design
18. Backup Strategy
19. Deployment Architecture
20. Performance Strategy
21. Import/Export & Data Migration Plan
22. Future Expansion Plan
23. Implementation Roadmap (phases for Claude Code)
24. Appendix A — Screen Inventory Checklist
25. Appendix B — Confirmed Design Decisions

---

# 1. Executive Summary & Analysis of Provided Materials

## 1.1 Company Context

Al Farooque operates a wood works factory (WW-03) in Bahara, Jeddah, Saudi Arabia, manufacturing interior fit-out, furniture, joinery, fire-rated doors, glass and aluminium works, and executing custom contracting projects. Two legal entities issue quotations:

| Entity | Used for | Identifiers seen |
|---|---|---|
| **Alfarooque Wood Works Factory (WW-03)** | Factory production quotations | Bahara, Jeddah; Phone 0590622801 |
| **Ismail Al Farooque General Contracting (IAAE)** | Contracting / cost estimations | CR 4031010693; Phone 0564466661 |

Jurisdiction facts baked into this design: **currency SAR**, **VAT 15%** (Saudi Arabia), **ZATCA e-invoicing environment** (future phase), **Arabic/English bilingual business data**, Hijri/Gregorian dual dating optional on PDFs.

## 1.2 What the provided files revealed

| Source | Findings that drive the design |
|---|---|
| **Purchases Products Report (مخزن المصنع), 2,421 rows** | Live material purchasing data: supplier (Arabic names), product code, product name (Arabic), qty, unit (حبة), unit cost, 15% tax, discount, total, payment/receipt status. This becomes the seed for the **Material Master** and **Price History** (each purchase line = a price point per supplier per date). |
| **Sales Team Quotation Generator (Standard Price List)** | The company already runs a two-tier model: a maintained **standard price list** (categories: DOORS-WOOD, DOORS-MDF, DOORS-INTERIOR, DOORS-STEEL, CHAIRS, SOFA, CUPBOARDS, CURTAINS) with unit prices and units (NOS., PCS, SQ.M), used by sales staff for **quick quotes**. This must become the **Product Catalogue + Quick Quote mode**. |
| **WW-03 / IAAE Quotation Samples & Arshad Quotations (862 series, Agave Hotel, Veneer Doors…)** | Real quotation layout: header (entity, date, project no., customer ID, valid-till ≈ 7 days), line items with QUANTITY / DESCRIPTION / DETAILS (multi-line sub-descriptions) / UNIT / UNIT PRICE / TAXABLE? / AMOUNT, then SUBTOTAL → Discount → VAT 15% → TOTAL, terms & conditions block. Line items support **multi-line scope descriptions** (e.g. AC installation with 4 sub-bullets) — the PDF generator must reproduce this. |
| **WW-03 Customer Details.xlsx (~280 customers)** | Customer registry: company name (Arabic), contact person, phone. Mostly hotels, contractors, engineers. Seeds the **Customers module**; import must handle Arabic names and missing fields. |
| **Data Sheets of Materials (23 PDFs)** | Technical datasheets (plywood, beech, iroko, spruce, Ritver PU paint systems, AKADA fire-door hardware with Intertek/UL certificates). Materials need an **attachments** capability and a **certification flag** (fire-rated compliance). |
| **Fire Door Audit folder + fire-rated door quotations (2013 series)** | Fire-rated doors are a certified product line → products need **compliance metadata** and attachment of certificates to quotations. |
| **Overtime Compensation Sheet, Organisation Chart** | Labour cost data exists (attendance/overtime) → **Labour rate templates** with hourly/daily/monthly rates; org chart informs roles. |
| **Purchase Request Logbooks, Purchase Quotation folder, Suppliers Details, Pro forma Invoice samples** | Procurement is a live process → Supplier master, supplier price history, and (future) purchase-request integration. |
| **Letterheads, catalogue.pdf, Price List Word template** | Branding assets for PDF generation; the system must render entity-specific letterheads. |

## 1.3 Current pain points (inferred) → design responses

| Pain point | Design response |
|---|---|
| Quotations built manually in Excel; formulas break; no numbering control | Central web app with automatic per-entity numbering, locked calculations, autosave |
| Price list, cost data, and quotations disconnected | Master data (materials/labour/expenses/products) feeds quotations via snapshot-copy; masters never mutated by a quote |
| No margin visibility when quoting from price list | Every product carries production cost + overhead + risk + profit breakdown; live margin shown while editing |
| No history: price changes, revisions, who did what | Price history, quotation revisions, full audit log |
| Customer/supplier data trapped in spreadsheets | Importers for the exact Excel formats provided |
| No approval control | Draft → Review → Approved → Sent workflow with thresholds |
| Arabic data in English tools | Bilingual EN/AR UI with RTL, bilingual fields on all master data, PDF in either language |

## 1.4 Solution overview

A Next.js (App Router) + Supabase application at **quotation.alfarooque.com**, visually and technically consistent with cars.alfarooque.com and projects.alfarooque.com. Core capabilities:

- **Master data:** Customers, Projects, Suppliers, Materials, Hardware, Labour templates, Machine rates, Expense templates, Product Catalogue.
- **Quotation engine:** unlimited products per quotation; each product composed of materials, hardware, labour, machines, expenses, other costs; automatic Production Cost → Overhead → Risk → Profit → Selling Price; quotation summary with Subtotal → Discount → Net → VAT → Grand Total.
- **Two quoting modes:** Quick Quote (pick from catalogue) and Detailed Costing (full BOM build-up); a costed product can be published back to the catalogue.
- **Governance:** roles/permissions, approval workflow, revisions, audit trail, activity logs.
- **Output:** branded bilingual PDF per entity, email via Resend, WhatsApp share link.
- **Enterprise UX:** dark mode, global search (Ctrl+K), keyboard shortcuts, autosave, favorites, recently used, bulk edit, Excel import/export, drag-drop attachments.

---

# 2. Business Requirement Document (BRD)

## 2.1 Business objectives

| # | Objective | Success metric |
|---|---|---|
| BO-1 | Cut quotation preparation time | Detailed quotation in ≤ 30 min (vs hours in Excel); quick quote in ≤ 5 min |
| BO-2 | Protect margins | 100% of quotations show live margin; approvals enforced below margin threshold |
| BO-3 | Single source of truth for prices | Material/labour/expense masters updated centrally; price history retained indefinitely |
| BO-4 | Professional, consistent output | Branded PDF per entity, bilingual, generated in < 5 s |
| BO-5 | Accountability | Every create/edit/status change attributed and logged |
| BO-6 | Scale | Thousands of quotations and 10,000+ material records with sub-second search |

## 2.2 Scope

**In scope (v1):** Customers, Projects, Suppliers, Materials + Hardware masters, Labour/Machine/Expense templates, Product Catalogue, Quotations (both modes), costing engine, approvals, revisions, PDF/email, dashboards & reports, user management, roles, audit/activity logs, import/export, settings (VAT, profit, overhead, numbering, entities), notifications, global search, dark mode, bilingual UI.

**Out of scope (v1, planned later):** invoicing & ZATCA e-invoicing, inventory/stock deduction, purchase orders, production scheduling, customer portal, payments, mobile apps, accounting integration. (See §22.)

## 2.3 Stakeholders & departments

| Department / Actor | Involvement |
|---|---|
| Owner / General Manager | Approves quotations, sets profit/overhead policy, sees all analytics |
| Estimation / Costing Engineer | Builds detailed product costings |
| Sales team | Quick quotes, customer management, follow-ups |
| Factory / Production Supervisor | Validates labour hours & machine times; consumes approved quotation BOM |
| Procurement / Store (مخزن المصنع) | Maintains material prices & suppliers, records purchase price updates |
| Accounts | VAT correctness, discounts, exports |
| Admin / IT | Users, permissions, settings, backups |

## 2.4 Business rules (authoritative)

- BR-1 VAT default 15%, configurable per entity in VAT Settings; line items can be marked non-taxable.
- BR-2 Currency SAR, 2 decimals, display formatting `1,234.56 SAR / ر.س`.
- BR-3 Quotation numbering per entity: `{PREFIX}-{YYYY}-{SEQ}` e.g. `WW-2026-0147`, `IAAE-2026-0032`; revisions append `-R1`, `-R2`. Prefixes and next-sequence editable in Settings.
- BR-4 Editing master data never changes existing quotations (snapshot on insert). Editing a quotation line never changes master data.
- BR-5 A quotation becomes immutable when status ≥ Approved; changes require creating a new revision.
- BR-6 Default validity 7 days (configurable); expired quotations flagged automatically.
- BR-7 Approval required when: grand total ≥ threshold (default 50,000 SAR) OR blended margin < threshold (default 15%) OR discount > threshold (default 10%). Otherwise auto-approvable by creator with `quotations.approve_own` permission.
- BR-8 Waste %: material line cost = qty × unit price × (1 + waste%). Waste default comes from material master, editable per line.
- BR-9 Cost visibility: internal cost breakdown never appears on customer PDF; roles without `costs.view` see selling prices only.
- BR-10 Soft delete everywhere (`deleted_at`); hard delete admin-only via retention job.

## 2.5 Assumptions & constraints

- Existing Supabase org and Vercel account reused; new Supabase project (or new schema) dedicated to quotations.
- Auth shared pattern with existing apps (Supabase Auth); staff count ≤ ~50 users initially.
- Internet-connected usage; offline mode not required v1 (autosave + drafts mitigate).
- Excel imports will match the formats of the provided files (mappings in §21).

---

# 3. Software Requirement Specification (SRS)

## 3.1 Functional requirements

### 3.1.1 Customers (FR-CUS)
- FR-CUS-1 CRUD customers: company name (AR/EN), contact person, phone(s), email, address, city, VAT reg. no., CR no., customer type (Hotel, Contractor, Individual, Engineer/Consultant, Government, Other), notes, tags, status (active/inactive).
- FR-CUS-2 List with search (Arabic-aware), filters (type, city, tag, status), sort, pagination; row shows quotation count & total value.
- FR-CUS-3 Customer detail: profile, quotations tab, projects tab, contacts tab (multiple contacts), attachments, activity.
- FR-CUS-4 Merge duplicates (admin) preserving quotation links.
- FR-CUS-5 Excel import matching `WW-03 Customer Details.xlsx` (columns: #, Company Name, Customer Name, Contact Number) with dedupe preview.

### 3.1.2 Projects (FR-PRJ)
- FR-PRJ-1 CRUD projects: code (e.g. 2013, 862), name (AR/EN), customer, location, type (Fit-out, Doors, Furniture, Contracting, Maintenance…), status (Lead, Quoting, Awarded, In Production, Delivered, Closed, Lost), start/end dates, notes, attachments.
- FR-PRJ-2 A quotation optionally belongs to a project; project rolls up all its quotations/revisions and win/loss.
- FR-PRJ-3 Project board (kanban by status) + table view.

### 3.1.3 Suppliers (FR-SUP)
- FR-SUP-1 CRUD suppliers: name (AR/EN), contact, phone, email, address, VAT no., CR no., categories supplied, payment terms, rating, status.
- FR-SUP-2 Supplier detail: materials supplied, price history, purchase lines imported, attachments.

### 3.1.4 Materials & Material Master (FR-MAT)
- FR-MAT-1 CRUD materials: code (auto or manual, unique), name AR, name EN, category (hierarchical), type (Sheet, Solid Wood, Board, Paint/Finish, Glass, Aluminium, Consumable, Other), thickness, size/dimensions, unit (Sheet, m, m², m³, Litre, Kg, Piece/حبة, Roll, Set…), default supplier, latest price, currency, default waste %, min/max price sanity bounds, barcode, brand, notes, image, datasheet attachments, certification flags (e.g. fire-rated, FSC), status, favorite flag.
- FR-MAT-2 **Smart search** (used in list AND inside quotation editor): as-you-type across code, name AR, name EN, barcode, category, supplier; result row displays *Name • Thickness • Size • Supplier • Unit • Latest Price • Waste % • Category*; keyboard navigable; supports barcode scanner input (fast keystrokes + Enter).
- FR-MAT-3 Filters: category tree, supplier, type, price range, status, has-certificate; sorts incl. recently used and most used.
- FR-MAT-4 Favorites (per user) and Recently Used (per user, last 50) surfaced first in quotation picker.
- FR-MAT-5 **Price History:** every price change (manual, bulk, import, purchase-report import) appends a history row: old/new price, supplier, source, date, user. Chart + table on material detail.
- FR-MAT-6 **Supplier History:** per material, list of suppliers with last price and last purchase date.
- FR-MAT-7 Excel import matching the Purchases Products Report format (§21.2): creates/updates materials, appends price history, links suppliers.
- FR-MAT-8 Bulk update: multi-select → set category/supplier/waste%/status; bulk price update by % or fixed, filtered by category/supplier, with preview and undo window.
- FR-MAT-9 Hardware is a material category family (Hinges, Locks, Handles, Screws, Slides, Accessories…) with the same behaviour but its own screen entry point and picker tab.

### 3.1.5 Labour (FR-LAB)
- FR-LAB-1 CRUD labour templates: role name AR/EN (Carpenter, Senior Carpenter, Helper, Painter, Installer, Supervisor, Designer, Project Engineer…), hourly rate, daily rate, monthly rate, overtime multiplier, default unit (hour/day/month), notes, status.
- FR-LAB-2 Selecting a labour type in a costing auto-fills current rate for chosen unit; per-line override allowed; master unchanged (BR-4).
- FR-LAB-3 Rate history like materials.

### 3.1.6 Machines (FR-MCH)
- FR-MCH-1 CRUD machines: name AR/EN, code, category (Panel Saw, CNC, Edge Bander, Press, Spray Booth…), hourly cost (depreciation+power+maintenance), setup cost, notes, status; linked to Machines List - WW-03 data.
- FR-MCH-2 Used as cost lines in product costing (hours × hourly cost + setup).

### 3.1.7 Expenses (FR-EXP)
- FR-EXP-1 CRUD expense templates: name AR/EN, category (Transport, Fuel, Installation, Accommodation, Packaging, Food, Miscellaneous, Consumables, Equipment Rental), default amount, unit (fixed, per-day, per-trip, per-unit, % of production cost), notes, status.
- FR-EXP-2 Selecting a template auto-fills default; per-quotation adjustment allowed; master unchanged.

### 3.1.8 Product Catalogue & Product Costing (FR-PRD)
- FR-PRD-1 CRUD catalogue products: code, name AR/EN, category (as in current price list), description AR/EN (multi-line, printed on PDF), unit (NOS., PCS, SQ.M, LM, SET…), images, attachments, standard selling price, last calculated cost, status, tags (e.g. fire-rated).
- FR-PRD-2 Each product owns an optional **cost model**: sections Materials, Hardware, Labour, Machines, Expenses, Other Costs; each line = ref to master (snapshot) + qty + unit + unit cost + waste%/multiplier + line total.
- FR-PRD-3 **Cost summary** computed per product: Direct Material, Direct Labour, Machine, Direct Expenses, Other = **Production Cost**; + Overhead % → + Risk % → **Total Cost**; + Profit (% or fixed) → **Selling Price**; shows Profit %, Margin % (profit / selling), and rounding rule (e.g. to nearest 5 SAR, configurable).
- FR-PRD-4 Duplicate product (with cost model); versioned recost ("Recost with latest prices" produces diff preview: old vs new line costs).
- FR-PRD-5 Publish/update catalogue price from a quotation product ("Save to catalogue").

### 3.1.9 Quotations (FR-QUO)
- FR-QUO-1 Create quotation: entity (WW/IAAE), customer (or quick-create), project (optional), date, validity, salesperson, currency (SAR), language of output (AR/EN), payment terms, delivery terms, notes, internal notes, terms & conditions (template per entity, editable).
- FR-QUO-2 Add unlimited products: (a) from catalogue (Quick Quote — price & description snapshot, editable), (b) blank detailed product (full cost build-up as FR-PRD-2/3 inline), (c) duplicate an existing product from this or another quotation.
- FR-QUO-3 Per line: qty, unit, unit selling price, taxable flag, optional line discount, multi-line description/details, optional image on PDF.
- FR-QUO-4 Summary auto-calc: Subtotal → Discount (% or amount, header level) → Net Total → VAT (per taxable lines) → **Grand Total**; blended cost, profit and margin shown internally.
- FR-QUO-5 Statuses: `draft → pending_approval → approved → sent → (accepted | rejected | expired) → converted(project)`; `cancelled` from any pre-accepted state. Guard rules per BR-5/BR-7.
- FR-QUO-6 Revisions: "New revision" clones the quotation as `-Rn`, previous becomes read-only `superseded`; revision compare view (line-level diff).
- FR-QUO-7 Autosave every 3 s of idle / on blur; draft recovery banner; optimistic-lock warning if another user edits.
- FR-QUO-8 Duplicate quotation (same or other customer/entity, prices refreshed optionally).
- FR-QUO-9 PDF: entity letterhead, bilingual layout option, product images optional, multi-line details, totals block, T&C, signature block, page numbers, QR (link to public read-only view, optional). Preview before send.
- FR-QUO-10 Send: email via Resend (template with PDF attached), or share link/WhatsApp; log every send.
- FR-QUO-11 Follow-ups: next-action date + note; dashboard reminder; expiry auto-flag.
- FR-QUO-12 Attachments: drag-drop files (drawings, datasheets, fire certificates) stored in Supabase Storage.
- FR-QUO-13 Win/Loss capture on accept/reject: reason codes + competitor + notes (feeds analytics).

### 3.1.10 Reports & Analytics (FR-RPT)
- FR-RPT-1 Quotation register (filters: entity, status, customer, salesperson, project, date range) → table + Excel/PDF export.
- FR-RPT-2 Sales funnel & win-rate by salesperson / customer type / product category / month.
- FR-RPT-3 Margin analysis: quoted margin distribution, low-margin list, margin by category.
- FR-RPT-4 Material price movement report; top used materials; supplier comparison.
- FR-RPT-5 VAT summary per period per entity.
- FR-RPT-6 Customer statement of quotations; inactive-customer list.

### 3.1.11 Administration (FR-ADM)
- FR-ADM-1 User management: invite, activate/deactivate, assign role(s), reset password, per-user entity access.
- FR-ADM-2 Settings: entities (name AR/EN, logo, CR, VAT no., address, phone, letterhead, T&C templates, numbering), VAT settings, Profit settings (default profit %, overhead %, risk %, rounding, approval thresholds per BR-7), units, categories, expense/labour categories, email templates, language defaults.
- FR-ADM-3 Audit log (immutable): who, what, before/after JSON, when, IP; filterable; export.
- FR-ADM-4 Activity feed (human-readable timeline per record and global).
- FR-ADM-5 Notifications: in-app bell + optional email (approval requested, approved/rejected, quotation expiring in 2 days, price import completed, mention in comment).
- FR-ADM-6 Import/Export centre: all importers (§21), all exports, background job status, error files.

### 3.1.12 Cross-cutting UX (FR-UX)
- FR-UX-1 Global search (Ctrl+K): quotations, customers, products, materials, projects, suppliers; grouped results; recent searches.
- FR-UX-2 Keyboard shortcuts (§7.14); shortcut help overlay (?).
- FR-UX-3 Dark mode (system/user toggle, persisted).
- FR-UX-4 Responsive: desktop-first; tablet full support; mobile read/approve/status flows.
- FR-UX-5 Bilingual UI EN/AR with full RTL mirroring; per-user language; data fields bilingual where defined.
- FR-UX-6 Bulk editing on all list screens (multi-select action bar).
- FR-UX-7 Saved views/filters per user per list.

## 3.2 Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 Performance | Material search results | < 150 ms server, < 300 ms perceived |
| NFR-2 Performance | Quotation editor interaction (recalc) | < 50 ms client-side |
| NFR-3 Performance | PDF generation | < 5 s for 20-product quotation |
| NFR-4 Scale | 10k materials, 5k customers, 50k quotations, 500k quotation lines | no degradation (indexes §11) |
| NFR-5 Availability | Vercel + Supabase managed SLAs | 99.9% target |
| NFR-6 Security | RLS on every table; least-privilege roles; OWASP top-10 hygiene | §17 |
| NFR-7 Auditability | 100% of writes attributable | audit triggers |
| NFR-8 Localisation | Full RTL; Arabic collation search | pg trigram + unaccent-ar strategy |
| NFR-9 Compatibility | Latest Chrome/Edge/Safari; iPad Safari | — |
| NFR-10 Backup/RPO/RTO | RPO ≤ 24 h (PITR target ≤ 5 min), RTO ≤ 4 h | §18 |
| NFR-11 Code standards | TypeScript strict, ESLint/Prettier as existing repos, conventional commits | — |

---

# 4. Business Workflow

## 4.1 End-to-end quotation lifecycle

```
 Enquiry received (phone/site visit/email)
        │
        ▼
 [Sales] Create/lookup Customer ──► optional Project
        │
        ▼
 Choose mode:
   A) QUICK QUOTE ──► pick catalogue products, adjust qty/price
   B) DETAILED     ──► Estimator builds product cost models
        │                 (materials+hardware+labour+machines+expenses)
        ▼
 Quotation DRAFT  ◄──── autosave, attachments, internal notes
        │  "Submit"
        ▼
 Threshold check (BR-7)
   ├─ within limits ──────────────► APPROVED (auto, logged)
   └─ exceeds ──► PENDING APPROVAL ─► [Manager] approve / reject(+reason)
        │                                   │ reject → back to DRAFT
        ▼
 APPROVED (locked) ──► PDF preview ──► SENT (email/WhatsApp/print)
        │
        ├── customer negotiates ──► NEW REVISION (-R1…) → cycle repeats
        ├── ACCEPTED ──► Win reason → Project status "Awarded"
        │                  └─► (future) convert to Sales Order/Invoice
        ├── REJECTED ──► Loss reason + competitor
        └── validity passed ──► EXPIRED (auto) ──► follow-up task
```

## 4.2 Master-data maintenance workflow

```
Procurement receives supplier invoice / price change
   └► Materials: update price (single) OR Import purchases Excel (bulk)
         └► price_history row appended, notification to Estimation
Estimation reviews "Price changes since last recost" report
   └► optionally "Recost" catalogue products → approve new standard prices
Admin quarterly: review overhead %, risk %, profit defaults (Profit Settings)
```

## 4.3 Departmental swimlane (summary)

| Step | Sales | Estimation | Manager/Owner | Procurement | Accounts |
|---|---|---|---|---|---|
| Customer & enquiry | ● | | | | |
| Quick quote | ● | | | | |
| Detailed costing | | ● | | | |
| Price masters | | ◐ review | | ● maintain | |
| Approval | | | ● | | |
| Send & follow-up | ● | | ◐ | | |
| VAT/exports | | | | | ● |
| Win/loss & handover to production | ● | ◐ | ● | | |

---

# 5. User Flows

## 5.1 Create a detailed quotation (Estimator)
1. Dashboard → **New Quotation** (or `N` shortcut) → wizard step 1: entity, customer (typeahead; “+ New customer” inline), project, dates, output language.
2. Editor opens (draft autosaved). **Add Product → Detailed**.
3. Product panel: name AR/EN, qty, unit → tabs **Materials | Hardware | Labour | Machines | Expenses | Other**.
4. In Materials tab press `/` → smart picker: type "ام دي اف" → rows show name, 18mm, 122×244, supplier, sheet, 185.00 SAR, 10%, MDF. Enter to add. Adjust qty; per-line waste editable; master untouched.
5. Labour tab: pick "Carpenter" → daily rate autofilled → enter days. Machines: "CNC 2 h". Expenses: "Transport – Jeddah trip 350".
6. Cost Summary card (sticky right): Production 3,120 → Overhead 10% → Risk 3% → Profit 25% → **Selling 4,420.65 → round → 4,420** · Margin 20.0%. Estimator overrides selling to 4,500 → profit fields recompute inversely.
7. Repeat/duplicate products. Header discount 5%. Summary shows Subtotal, Discount, Net, VAT 15%, Grand Total + internal blended margin.
8. **Submit** → threshold check → e.g. total 120k → status Pending Approval → notification to Manager.

## 5.2 Quick quote (Salesperson)
New Quotation → Add Product → **From Catalogue** → search "Semi Solid Interior Door" → snapshot price 950 → qty 12 → optional price edit (margin floor warning if below min-margin) → Submit → auto-approved (within limits) → PDF Preview → Send email → status Sent.

## 5.3 Approve (Manager, possibly on phone)
Notification → Approvals screen → open quotation → read-only view with cost/margin panel and revision diff (if any) → **Approve** (or Reject with reason → returns to Draft, creator notified).

## 5.4 Update material prices from purchases (Procurement)
Materials → Import → upload Purchases Report .xlsx → mapping preview (auto-matched columns) → validation report (new materials: 12, price changes: 87, unchanged: 2,310) → confirm → background job → notification + price-history entries.

## 5.5 Revision after negotiation (Sales)
Sent quotation → **New Revision** → editable clone `-R1` → change discount to 8% → Submit → approval (discount > threshold) → Approved → Send. Original marked Superseded; compare view available.

## 5.6 Find anything (any user)
`Ctrl+K` → "agave" → grouped results: Quotation 2011-… Agave Coffee Shop, Customer Agave Hotel, Product Coffee Table → Enter navigates.

---

# 6. Screen Flow & Navigation Structure

## 6.1 Navigation (left sidebar, collapsible; mirrors existing apps)

```
▣ Dashboard
▤ Quotations            ▸ All / Drafts / Pending Approval / Sent / Accepted / Expired
▥ Customers
▦ Projects
▧ Catalogue (Products)
─────────  MASTER DATA
▨ Materials             ▸ All / Hardware / Categories / Price History / Import
▩ Labour
⚙ Machines
▪ Expenses
▫ Suppliers
─────────  INSIGHT
◈ Reports
◇ Analytics
─────────  ADMIN (role-gated)
◆ Users & Roles
◉ Settings              ▸ Entities / VAT / Profit / Numbering / Units & Categories / Email / T&C
◎ Audit Logs · Activity
⇅ Import / Export
─────────
🔔 Notifications (topbar) · 🔍 Global Search (topbar, Ctrl+K) · 👤 Profile · ☾ Dark mode
```

## 6.2 Screen flow map

```
Login ─► Dashboard ─┬► Quotations List ─► Quotation Editor ─┬► Product Cost Editor (drawer)
                    │                        │               ├► PDF Preview ─► Send dialog
                    │                        │               ├► Revision Compare
                    │                        └► Approval View
                    ├► Customers List ─► Customer Detail ─► (new quotation prefilled)
                    ├► Projects List/Board ─► Project Detail
                    ├► Catalogue List ─► Product Detail ─► Cost Model Editor
                    ├► Materials List ─► Material Detail (price/supplier history)
                    │        └► Import Wizard (3 steps)
                    ├► Labour / Machines / Expenses / Suppliers (list ─► detail)
                    ├► Reports ─► report viewer ─► export
                    ├► Analytics dashboards
                    └► Admin: Users · Settings · Audit · Import/Export
```

Route table (Next.js App Router):

| Route | Screen |
|---|---|
| `/` | Dashboard |
| `/quotations` · `/quotations/new` · `/quotations/[id]` · `/quotations/[id]/preview` · `/quotations/[id]/compare/[revId]` | Quotations |
| `/customers` · `/customers/[id]` | Customers |
| `/projects` · `/projects/[id]` | Projects |
| `/catalogue` · `/catalogue/[id]` | Products |
| `/materials` · `/materials/[id]` · `/materials/import` | Materials (tab `?type=hardware`) |
| `/labour` · `/machines` · `/expenses` · `/suppliers` (+`/[id]`) | Templates/masters |
| `/reports` · `/reports/[slug]` · `/analytics` | Insight |
| `/admin/users` · `/admin/settings/*` · `/admin/audit` · `/admin/activity` · `/admin/import-export` | Admin |
| `/profile` · `/notifications` · `/search?q=` | Utility |
| `/q/[publicToken]` | Public read-only quotation view (QR) |

---

# 7. UI Wireframes

Design language: identical tokens to cars/projects apps — Tailwind, card-based, 8-px grid, `Inter` + `IBM Plex Sans Arabic`, brand accent from Al Farooque logo, subtle borders, shadcn/ui-style components. All layouts mirror for RTL.

## 7.1 App shell
```
┌────────────────────────────────────────────────────────────────────┐
│ ☰  AL FAROOQUE · Quotations     [🔍 Search  Ctrl+K]   ☾  🔔3  AR|EN ⌄👤│
├──────────┬─────────────────────────────────────────────────────────┤
│ SIDEBAR  │  PAGE HEADER  (title · breadcrumbs · primary actions)   │
│ (6.1)    │  ─────────────────────────────────────────────────────  │
│          │  CONTENT                                                │
└──────────┴─────────────────────────────────────────────────────────┘
```

## 7.2 Dashboard — see §8.

## 7.3 Quotations list
```
[+ New Quotation]                    [Saved views ⌄][Filters ⌄][⇩ Export]
Tabs: All | Draft | Pending(2) | Approved | Sent | Accepted | Expired
┌─┬──────────┬────────────────┬─────────────┬────────┬─────────┬───────┬────────┐
│☐│ No.      │ Customer        │ Project     │ Total  │ Margin* │Status │ Valid  │
│☐│WW-2026-0147│ فندق قرون الفخمة│ 2013 FireDrs│ 84,525 │ 22.4%   │● Sent │ 3d left│
│☐│IAAE-2026-0032│ Agave Hotel │ 2011 Tables │ 12,650 │ 18.1%   │◐ Pend │ —      │
└─┴──────────┴────────────────┴─────────────┴────────┴─────────┴───────┴────────┘
☐ n selected → [Change status][Assign][Export][Delete]        * hidden without costs.view
```

## 7.4 Quotation editor (core screen)
```
┌ WW-2026-0147 · R0 · DRAFT ── autosaved 12:02 ✓ ─────────────────────────────┐
│ [Entity: WW ⌄][Customer: فندق قرون… ⌄][Project ⌄][Date][Valid 7d][Lang AR|EN]│
├──────────────────────────────────────────────┬───────────────────────────────┤
│ PRODUCTS                       [+ Add ⌄]     │  QUOTATION SUMMARY (sticky)   │
│  ├ From Catalogue  ├ Detailed  ├ Duplicate   │  Subtotal        84,525.00    │
│ ┌─────────────────────────────────────────┐  │  Discount [5 %]  −4,226.25    │
│ │▸ 1. Fire Rated Door 90min  12 NOS ×6,500│  │  Net             80,298.75    │
│ │   ▤ description (multi-line, on PDF)    │  │  VAT 15%         12,044.81    │
│ │   Cost 4,890 · Margin 24.8%  [⋮ dup/del]│  │  ─────────────────────────    │
│ │▾ 2. Reception Counter  1 SET × 18,000   │  │  GRAND TOTAL     92,343.56    │
│ │  Tabs: Materials|Hardware|Labour|       │  │  ······ internal ······       │
│ │        Machines|Expenses|Other          │  │  Cost 61,204 · Profit 19,095  │
│ │  ┌ Materials ─ [/ search materials…] ┐  │  │  Blended margin 23.1% ✅      │
│ │  │ MDF 18mm 122×244 · SABIC · Sheet  │  │  ├───────────────────────────────┤
│ │  │  qty 14 × 185.00 · waste 10% =2,849│ │  │ [Submit for Approval]         │
│ │  │ HPL White 0.8mm  qty 8 × 95 = 760 │  │  │ [Preview PDF] [⋮ More]        │
│ │  └───────────────────────────────────┘  │  └───────────────────────────────┘
│ │  Cost Summary: Prod 12,410 → OH 10% →   │
│ │  Risk 3% → Profit 25% → Sell 17,568 →   │
│ │  [Selling: 18,000] Margin 21.9%         │
│ └─────────────────────────────────────────┘
│ [Notes to customer][Internal notes][T&C template ⌄][📎 drop attachments]     │
└──────────────────────────────────────────────────────────────────────────────┘
```
Material picker popover (invoked by `/`):
```
┌ Search materials… "مدف 18" ────────────────── [Materials|Hardware] tabs ┐
│ ★ Recently used                                                        │
│ ام دي اف 18مم صيني | 18mm | 122×244 | خالد بن إسحاق | Sheet | 185.00 | 10% | MDF │
│ MDF 18mm Spanish   | 18mm | 122×244 | Al Mac Co.     | Sheet | 210.00 |  8% | MDF │
│ [＋ Create new material] (permission-gated)     ↑↓ navigate · Enter add │
└────────────────────────────────────────────────────────────────────────┘
```

## 7.5 PDF Preview
Split view: left = live A4 render (entity letterhead, bilingual toggle, show/hide images, show/hide line discounts), right = options + [Download] [Send Email] [Copy link] [WhatsApp]. Email dialog: to/cc (customer contacts prefilled), subject template, body template, PDF attached, send log.

## 7.6 Customers
List (search AR/EN, type filter, city) → Detail with header card (names, phones click-to-call, VAT/CR) + tabs: Quotations (with totals & win rate), Projects, Contacts, Attachments, Activity. [+ New Quotation] prefilled.

## 7.7 Projects
Table + Kanban (Lead → Quoting → Awarded → In Production → Delivered → Closed/Lost). Detail: info card, quotations timeline incl. revisions, attachments, activity.

## 7.8 Catalogue product detail
Header: image, code, name AR/EN, category, unit, standard price, last cost, margin badge, [Recost] [Duplicate] [Use in Quotation].
Tabs: Overview (description AR/EN) · **Cost Model** (same six-tab editor as 7.4) · Price History · Attachments · Where Used (quotations count) · Activity.

## 7.9 Materials
List: dense table (code, name AR/EN, thickness, size, unit, category, supplier, latest price ▲▼ vs previous, waste %, updated) + category tree left rail + filter bar + [Import][Bulk update][+ New].
Detail: spec card, price chart (12-mo), price history table (date, price, supplier, source, user), supplier history, attachments (datasheets), where-used, activity. Barcode field with scan focus.
Import wizard: Upload → Map columns (auto for known template) → Validate (errors downloadable) → Commit (background job + progress).

## 7.10 Labour / Machines / Expenses
Simple master tables with inline edit, rate history drawer, status toggle, drag-order categories. Each row: name AR/EN + rates/defaults + updated-by.

## 7.11 Suppliers
List + detail (materials supplied with latest prices, imported purchase lines, contacts, attachments, rating).

## 7.12 Reports & Analytics
Reports = parameterised tabular reports (FR-RPT list) with filter panel → run → table → export xlsx/pdf.
Analytics = visual dashboards (§8.3).

## 7.13 Admin screens
- **Users:** table (name, email, role, entities, status, last login) + invite dialog + role editor (permission matrix checkboxes per §13).
- **Settings:** left-tabbed panels — Entities (branding/letterhead/numbering/T&C), VAT, Profit & thresholds, Units & Categories, Email templates, Language.
- **Audit Logs:** filterable table with before/after JSON diff viewer. **Activity:** timeline.
- **Import/Export:** job list (type, file, status, rows ok/failed, started by), new import launcher, export centre.
- **Profile:** avatar, name, language, theme, shortcuts toggle, notification preferences, sessions.
- **Notifications:** list + mark read + preferences link.

## 7.14 Keyboard shortcuts
`Ctrl+K` search · `N` new quotation · `/` material picker (in editor) · `Ctrl+S` force save · `Ctrl+D` duplicate line · `Alt+↑/↓` reorder line · `Ctrl+Enter` submit · `G then Q/C/M/P` go to Quotations/Customers/Materials/Products · `?` help overlay · `Esc` close drawer.

---

# 8. Dashboard Design

## 8.1 Layout
```
Row 1 · KPI cards: Quotations this month (n, Δ%) · Value quoted (SAR) ·
        Win rate 90d · Avg margin 90d · Pending approvals (n) · Expiring ≤3d (n)
Row 2 · [Pipeline funnel Draft→Sent→Accepted] · [Monthly quoted vs accepted bar, 12m]
Row 3 · [My tasks: approvals awaiting me / my drafts / my follow-ups]
        [Recent activity feed] · [Top customers 90d] · [Material price alerts]
Quick actions strip: + Quotation · + Customer · + Material · Import prices
```

## 8.2 Role-sensitivity
Salesperson sees own pipeline & follow-ups; Estimator sees recost alerts & drafts; Manager sees approvals, margins, win rate; Admin sees jobs & system health. Cards permission-gated (margin cards need `costs.view`).

## 8.3 Analytics dashboards
1. **Sales:** funnel, win/loss reasons pareto, salesperson leaderboard, avg turnaround (draft→sent).
2. **Margin:** margin histogram, low-margin quotations, margin by category/entity.
3. **Materials:** price index trend, top movers, most-used materials, supplier share.
4. **Customers:** RFM-style activity, top accounts, dormant accounts.

---

# 9. Costing Engine Specification

## 9.1 Product-level formulas
```
material_line  = qty × unit_price × (1 + waste_pct/100)
hardware_line  = qty × unit_price × (1 + waste_pct/100)      (waste usually 0)
labour_line    = qty(hours|days|months) × rate                (rate per chosen unit)
machine_line   = hours × hourly_cost + setup_cost
expense_line   = amount | rate×qty | pct_of_production_cost
other_line     = amount

DIRECT_MATERIAL = Σ material + Σ hardware
DIRECT_LABOUR   = Σ labour
MACHINE_COST    = Σ machines
DIRECT_EXPENSE  = Σ expenses(non-%) ; %-type applied after PRODUCTION_COST base
OTHER           = Σ other

PRODUCTION_COST = DIRECT_MATERIAL + DIRECT_LABOUR + MACHINE_COST + DIRECT_EXPENSE + OTHER
OVERHEAD        = PRODUCTION_COST × overhead_pct          (default from Profit Settings)
RISK            = (PRODUCTION_COST + OVERHEAD) × risk_pct
TOTAL_COST      = PRODUCTION_COST + OVERHEAD + RISK
PROFIT          = TOTAL_COST × profit_pct   |  fixed amount  |  derived (below)
SELLING_UNIT    = round_rule( TOTAL_COST + PROFIT ) / product_qty  → per-unit price
PROFIT_PCT      = PROFIT / TOTAL_COST × 100      (markup)
MARGIN_PCT      = PROFIT / SELLING × 100         (margin)
```
**Inverse mode:** user types Selling Price → `PROFIT = SELLING − TOTAL_COST`, profit% & margin% recomputed; warning badge if margin < min threshold.

## 9.2 Quotation-level formulas
```
line_amount   = qty × unit_selling_price − line_discount
SUBTOTAL      = Σ line_amount
DISCOUNT      = header % of SUBTOTAL | fixed
NET_TOTAL     = SUBTOTAL − DISCOUNT
VAT           = Σ over taxable lines of (line_share_of_net × vat_rate)
GRAND_TOTAL   = NET_TOTAL + VAT
BLENDED_COST  = Σ product total_cost × qty ;  BLENDED_MARGIN = (NET−COST)/NET
```
All money `numeric(14,2)`, percentages `numeric(6,3)`, calculations in SQL/TS with banker-safe rounding at line level then summed (matches ZATCA practice). Rounding rule for selling price configurable: none / 1 / 5 / 10 SAR.

## 9.3 Snapshot rule (BR-4 mechanics)
When a master item is inserted into a cost model, the line stores: `source_id` (FK, nullable), plus copied `name_ar/name_en, unit, unit_price, waste_pct, supplier_name, spec fields`. Subsequent master edits do not cascade. "Refresh price" action per line/product shows old→new diff before applying.

---

# 10. Database ER Diagram

```
entities ──< quotations >── customers ──< customer_contacts
                │  │  └──────────────< projects (customer FK)
                │  └───< quotation_events (status/send/approval log)
                ▼
        quotation_products ──< qp_cost_lines (kind: material|hardware|labour|
                │                machine|expense|other; snapshot fields)
                └── catalogue_products (optional source FK)
                          └──< product_cost_lines (template cost model)

materials ──< material_price_history        labour_roles ──< labour_rate_history
   │  └──< material_suppliers >── suppliers machines · expense_templates
   └── material_categories (tree)

users ──< user_roles >── roles ──< role_permissions >── permissions
users ──< favorites · recent_items · saved_views · notifications
audit_logs · activity_logs · attachments (polymorphic) · import_jobs
settings (per entity + global) · sequences (numbering) · terms_templates
```

Cardinal rules: quotations 1-* quotation_products 1-* qp_cost_lines; catalogue_products 1-* product_cost_lines; materials 1-* price_history; polymorphic `attachments(owner_type, owner_id)`; every table has `created_by/updated_by/created_at/updated_at/deleted_at`.

---

# 11. PostgreSQL Table Design (Supabase)

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz`, soft delete, `citext` for emails, `numeric(14,2)` money, `numeric(6,3)` percents, all FKs indexed, RLS enabled on all tables (§17). Trigram + unaccent indexes for Arabic/English search.

```sql
-- ENTITIES & SETTINGS ------------------------------------------------
entities(id, code text unique,                -- 'WW', 'IAAE'
  name_en, name_ar, cr_number, vat_number, address_en, address_ar,
  phone, email, logo_path, letterhead_path, default_vat_rate numeric(5,2),
  quote_prefix, next_seq int, terms_default_id uuid, is_active bool, audit cols)

settings(id, entity_id uuid null, key text, value jsonb, unique(entity_id,key))
-- keys: profit_defaults{overhead_pct,risk_pct,profit_pct,rounding},
--       approval_thresholds{amount,min_margin,max_discount}, email_templates, units[]

terms_templates(id, entity_id, title, body_en, body_ar, is_default, audit)

-- PARTIES --------------------------------------------------------------
customers(id, code, company_name_ar, company_name_en, contact_person,
  phone, phone2, email citext, address, city, customer_type, vat_number,
  cr_number, tags text[], notes, status, audit)
customer_contacts(id, customer_id, name, role, phone, email, is_primary)
suppliers(id, name_ar, name_en, contact_person, phone, email citext,
  address, vat_number, cr_number, categories text[], payment_terms,
  rating smallint, notes, status, audit)
projects(id, code, name_ar, name_en, customer_id, entity_id, location,
  project_type, status, start_date, end_date, notes, audit)

-- MATERIAL MASTER -------------------------------------------------------
material_categories(id, parent_id, name_en, name_ar, kind text
  check (kind in ('material','hardware')), sort int)
materials(id, code text unique, barcode, name_ar, name_en, category_id,
  kind text default 'material',            -- material | hardware
  material_type, thickness, size_text, unit, brand,
  default_supplier_id, latest_price numeric(14,2), currency char(3) default 'SAR',
  default_waste_pct numeric(6,3) default 0, min_price, max_price,
  is_certified bool, cert_notes, image_path, notes, status, audit)
material_price_history(id, material_id, price, previous_price, supplier_id,
  source text,          -- manual | bulk | import | purchase_report
  source_ref, effective_date date, created_by, created_at)
material_suppliers(material_id, supplier_id, last_price, last_purchase_at,
  supplier_code, primary key(material_id,supplier_id))

-- LABOUR / MACHINES / EXPENSES -------------------------------------------
labour_roles(id, name_en, name_ar, hourly_rate, daily_rate, monthly_rate,
  overtime_multiplier numeric(4,2) default 1.5, default_unit, notes, status, audit)
labour_rate_history(id, labour_role_id, field, old_value, new_value, created_by, created_at)
machines(id, code, name_en, name_ar, category, hourly_cost, setup_cost,
  notes, status, audit)
expense_templates(id, name_en, name_ar, category, default_amount,
  unit text check (unit in ('fixed','per_day','per_trip','per_unit','pct_production')),
  notes, status, audit)

-- CATALOGUE ---------------------------------------------------------------
catalogue_products(id, code unique, name_en, name_ar, category, description_en,
  description_ar, unit, standard_price, last_calculated_cost, last_costed_at,
  image_path, tags text[], status, audit)
product_cost_lines(id, product_id, section text check (section in
  ('material','hardware','labour','machine','expense','other')),
  source_id uuid null, sort int,
  -- snapshot:
  name_ar, name_en, spec_text, unit, qty numeric(14,3), unit_cost numeric(14,4),
  waste_pct numeric(6,3), extra jsonb,     -- setup_cost, pct_base, etc.
  line_total numeric(14,2), audit)
catalogue_price_history(id, product_id, price, cost, created_by, created_at)

-- QUOTATIONS ---------------------------------------------------------------
quotations(id, entity_id, quote_number text unique, revision int default 0,
  parent_id uuid null,                     -- previous revision
  root_id uuid,                            -- revision family
  customer_id, project_id null, salesperson_id, status text check (status in
   ('draft','pending_approval','approved','sent','accepted','rejected',
    'expired','superseded','cancelled')),
  quote_date date, valid_until date, output_lang char(2) default 'en',
  currency char(3) default 'SAR',
  payment_terms, delivery_terms, customer_notes, internal_notes,
  terms_template_id, terms_body_override,
  discount_type text check (discount_type in ('pct','amount')) , discount_value,
  subtotal, discount_amount, net_total, vat_rate numeric(5,2), vat_amount,
  grand_total, total_cost, blended_margin_pct,
  follow_up_at date, follow_up_note,
  won_lost_reason, competitor, public_token uuid, audit)
quotation_products(id, quotation_id, sort int, catalogue_product_id null,
  name_en, name_ar, description_en, description_ar, unit, qty numeric(14,3),
  unit_price numeric(14,2), taxable bool default true,
  line_discount numeric(14,2) default 0, line_total,
  image_path, -- costing rollups (null for pure quick-quote lines):
  production_cost, overhead_pct, overhead_amount, risk_pct, risk_amount,
  total_cost, profit_mode text, profit_value, profit_amount,
  margin_pct, audit)
qp_cost_lines(  -- same shape as product_cost_lines but FK quotation_product_id
  id, quotation_product_id, section, source_id, sort,
  name_ar, name_en, spec_text, unit, qty, unit_cost, waste_pct, extra jsonb,
  line_total, audit)
quotation_events(id, quotation_id, event text,   -- created/submitted/approved/
  -- rejected/sent_email/sent_link/accepted/rejected_by_customer/expired/…
  detail jsonb, actor_id, created_at)
quotation_approvals(id, quotation_id, requested_by, approver_id null,
  status text, reason, requested_at, decided_at)

-- USERS / RBAC ---------------------------------------------------------------
profiles(id uuid pk references auth.users, full_name, phone, avatar_path,
  language char(2), theme, is_active, last_login_at, audit)
roles(id, key unique, name_en, name_ar, is_system bool)
permissions(id, key unique, description)   -- seeded, §13
role_permissions(role_id, permission_id, pk both)
user_roles(user_id, role_id, pk both)
user_entities(user_id, entity_id, pk both) -- entity scoping

-- UX SUPPORT -------------------------------------------------------------
favorites(user_id, item_type, item_id, created_at, pk(user_id,item_type,item_id))
recent_items(user_id, item_type, item_id, used_at)         -- pruned to 50
saved_views(id, user_id, screen, name, filters jsonb, sort jsonb, is_default)
notifications(id, user_id, type, title, body, link, read_at, created_at)
attachments(id, owner_type, owner_id, file_path, file_name, mime, size_bytes,
  uploaded_by, created_at)                                   -- Supabase Storage
comments(id, owner_type, owner_id, body, mentions uuid[], created_by, created_at)

-- OPS ----------------------------------------------------------------------
import_jobs(id, type, file_path, status, total_rows, ok_rows, failed_rows,
  error_file_path, params jsonb, started_by, started_at, finished_at)
audit_logs(id bigserial, table_name, record_id uuid, action, old_data jsonb,
  new_data jsonb, actor_id, ip inet, created_at)             -- insert-only
activity_logs(id, owner_type, owner_id, verb, summary, actor_id, created_at)
```

**Key indexes**
```sql
create extension if not exists pg_trgm; create extension if not exists unaccent;
create index on materials using gin ((coalesce(name_ar,'')||' '||coalesce(name_en,'')||' '||code) gin_trgm_ops);
create index on customers using gin ((company_name_ar||' '||coalesce(company_name_en,'')) gin_trgm_ops);
create index on quotations (entity_id, status, quote_date desc);
create index on quotations (customer_id); create index on quotations (root_id);
create index on quotation_products (quotation_id, sort);
create index on qp_cost_lines (quotation_product_id);
create index on material_price_history (material_id, effective_date desc);
create index on audit_logs (table_name, record_id); create index on notifications (user_id, read_at);
partial: create unique index on quotations(quote_number) where deleted_at is null;
```

**Triggers/functions:** `set_updated_at()`; `audit_row()` generic trigger on all business tables; `next_quote_number(entity_id)` (advisory-locked); `recalc_quotation(id)` (server-side authoritative totals); status-transition guard trigger enforcing §FR-QUO-5; expiry cron (`pg_cron` daily → mark expired + notify).

---

# 12. API Design

Style: Next.js Route Handlers under `/api/v1/*` acting as thin, validated (Zod) wrappers over Supabase (server client with RLS) + Postgres RPC for transactional operations. JSON:api-ish envelope `{data, meta{page,total}, error}`; cursor pagination for big lists; all mutations audited.

| Method & path | Purpose |
|---|---|
| `GET/POST /customers` · `GET/PATCH/DELETE /customers/:id` · `POST /customers/:id/merge` | Customers |
| `GET/POST /suppliers…` `GET/POST /projects…` | as above |
| `GET /materials?search=&category=&kind=&supplier=&sort=` | smart search (trgm, ranked, ≤20) |
| `POST /materials` · `PATCH /materials/:id` · `POST /materials/bulk-update` | master + bulk (preview=true dry-run) |
| `GET /materials/:id/price-history` · `GET /materials/:id/suppliers` | histories |
| `POST /imports` (multipart, type=purchases|customers|materials|catalogue) · `GET /imports/:id` | import jobs |
| `GET/POST /labour` `/machines` `/expense-templates` (+:id) | templates |
| `GET/POST /catalogue` · `GET/PATCH /catalogue/:id` · `POST /catalogue/:id/recost` (dry-run diff) · `POST /catalogue/:id/duplicate` | products |
| `GET/POST /quotations` · `GET/PATCH /quotations/:id` (draft only) | quotations |
| `POST /quotations/:id/products` · `PATCH/DELETE …/products/:pid` · `POST …/products/:pid/cost-lines` (batch upsert) | composition |
| `POST /quotations/:id/submit` · `/approve` · `/reject` · `/send` · `/accept` · `/reject-by-customer` · `/cancel` | status transitions (RPC, guarded) |
| `POST /quotations/:id/revise` · `POST /quotations/:id/duplicate` · `GET /quotations/:id/compare/:revId` | revisions |
| `GET /quotations/:id/pdf?lang=ar` | streamed PDF |
| `POST /quotations/:id/publish-product/:pid` | save costed product to catalogue |
| `GET /search?q=` | global search (union RPC) |
| `GET /reports/:slug?params` · `GET /analytics/:board` | reporting |
| `GET/POST /admin/users…` `GET/PUT /admin/settings…` `GET /admin/audit…` | admin |
| `GET/PATCH /notifications` · `GET/POST /favorites` `/saved-views` | UX |
| `GET /q/:publicToken` (no auth, rate-limited) | public quotation view |

Realtime (Supabase channels): `quotations:id` (co-edit lock/presence), `notifications:user_id`.
Error model: `{error:{code,message,fields?}}`; 401/403/404/409(version conflict)/422/429.

---

# 13. User Roles & Permissions

Permission keys (seeded): `customers.view/create/edit/delete`, `projects.*`, `suppliers.*`, `materials.view/create/edit/delete/import/bulk`, `labour.*`, `machines.*`, `expenses.*`, `catalogue.view/edit/recost`, `quotations.view_own/view_all/create/edit/delete`, `quotations.submit/approve/approve_own/send/accept_reject/revise`, `costs.view` (see cost & margin), `prices.edit_selling_below_floor`, `reports.view`, `analytics.view`, `admin.users`, `admin.settings`, `admin.audit`, `admin.import_export`.

| Role | Summary |
|---|---|
| **Owner/Admin** | Everything, all entities |
| **General Manager** | All view + approve + reports/analytics + settings-lite (thresholds) |
| **Estimator** | Masters view, catalogue edit/recost, quotations create/edit/submit, costs.view |
| **Salesperson** | Customers/projects CRUD, quick quotations create/edit/submit/send, view_own (+team optional), **no costs.view** by default |
| **Procurement/Store** | Materials/hardware/suppliers CRUD + import + bulk; no quotations |
| **Accounts** | Quotations view_all, reports, exports, VAT settings view |
| **Viewer** | Read-only dashboards & quotations |

Enforcement in three layers: (1) Postgres RLS policies keyed on `user_roles`/`user_entities`; (2) API route guards; (3) UI gating (hide/disable). Column-level: cost fields exposed through a `quotation_secure` view only when `costs.view`.

---

# 14. Folder Structure

```
quotation-app/
├─ app/
│  ├─ (auth)/login/…
│  ├─ (app)/                     # authed shell
│  │  ├─ layout.tsx  page.tsx    # shell + dashboard
│  │  ├─ quotations/ [id]/ new/ [id]/preview/ [id]/compare/[revId]/
│  │  ├─ customers/ [id]/  projects/ [id]/  catalogue/ [id]/
│  │  ├─ materials/ [id]/ import/   labour/ machines/ expenses/ suppliers/
│  │  ├─ reports/ [slug]/  analytics/
│  │  └─ admin/ users/ settings/ audit/ activity/ import-export/
│  ├─ q/[token]/page.tsx         # public view
│  └─ api/v1/…                   # route handlers per §12
├─ components/
│  ├─ ui/                        # shadcn-style primitives (shared w/ existing apps)
│  ├─ layout/  (Sidebar, Topbar, CommandPalette, ThemeToggle, LangToggle)
│  ├─ quotations/ (QuotationEditor, ProductCard, CostTabs, SummaryPanel,
│  │               MaterialPicker, StatusBadge, ApprovalBar, RevisionDiff)
│  ├─ masters/   (MaterialTable, PriceHistoryChart, ImportWizard, BulkEditBar)
│  ├─ pdf/       (QuotationPdf, templates per entity, ar/en layouts)
│  └─ shared/    (DataTable, FilterBar, SavedViews, AttachmentDrop, AuditDiff)
├─ lib/
│  ├─ supabase/ (client.ts server.ts middleware.ts types.gen.ts)
│  ├─ costing/  (engine.ts — pure functions §9, unit-tested)
│  ├─ validators/ (zod schemas shared client+server)
│  ├─ pdf/ i18n/ utils/ constants/
├─ hooks/ (useAutosave, useShortcuts, useMaterialSearch, useRealtime…)
├─ stores/ (quotation-editor.store.ts ui.store.ts)
├─ messages/ en.json ar.json      # next-intl
├─ supabase/ migrations/ seed/ functions/ (edge: pdf, import-worker, expiry-cron)
├─ tests/ (unit costing, e2e playwright)
└─ config: tailwind, eslint (inherit org presets), tsconfig strict
```

---

# 15. Component Architecture

- **Server Components** for all list/detail reads (fast, RLS-safe); **Client Components** only where interactive: QuotationEditor tree, pickers, charts, command palette.
- **QuotationEditor** = orchestrator; children are dumb/controlled: `ProductCard` → `CostSection(tab)` → `CostLineRow`; a single **costing engine** (pure TS in `lib/costing`) is the only place formulas live — used by client for instant totals and re-run server-side in `recalc_quotation` for authority.
- **DataTable** generic (TanStack Table): server pagination, column defs per module, row selection → BulkEditBar, saved views.
- **MaterialPicker** headless combobox + virtualized list; sources: favorites, recents, server search (debounced 150 ms).
- **PDF** rendered with `@react-pdf/renderer` in an Edge/Node route (Arabic font embedding: IBM Plex Sans Arabic; RTL text shaping verified).
- **ImportWizard** = stepper + web worker XLSX parse (SheetJS) + server job.
- Forms: React Hook Form + Zod resolver; identical schema objects validate API side.

---

# 16. State Management Strategy

| Concern | Tool |
|---|---|
| Server data (lists, details) | **TanStack Query** — cache keys per module, optimistic updates on mutations, `staleTime` 30 s masters / 0 s quotations |
| Quotation editor working copy | **Zustand** store (normalized: products[], costLines by productId) + derived totals via costing engine selectors; undo stack (last 50 ops) |
| Autosave | Debounced (3 s idle) diff-patch mutation from Zustand → API; version number for optimistic concurrency (409 → merge banner) |
| UI state (sidebar, theme, lang, palette) | Zustand `ui.store` + cookies for SSR theme/lang |
| Realtime | Supabase channel → invalidate queries / presence in editor |
| URL state | filters, tabs, pagination in searchParams (shareable views) |
| Forms | RHF local state; submit → mutation → query invalidation |

No Redux; no global god-store. Draft recovery: last autosave persisted server-side; localStorage fallback snapshot for network loss.

---

# 17. Security Design

- **Auth:** Supabase Auth (email+password, optional OTP later); middleware protects `(app)`; session refresh per existing apps' pattern.
- **RLS everywhere:** default deny. Policies: entity scoping via `user_entities`; `quotations` select policy = `view_all` OR (`view_own` AND salesperson_id = auth.uid()); write policies check permission via `has_perm(auth.uid(),'key')` SQL helper; masters writable only with respective perms; `audit_logs` insert-only, select admin.
- **Cost confidentiality:** cost/margin columns exposed via secure views/RPC gated by `costs.view`; PDFs never include cost fields; API strips them per role.
- **Status immutability:** DB trigger blocks UPDATE on quotations rows in status ≥ approved except whitelisted columns (status transitions, follow_up).
- **Input:** Zod on every route; file upload MIME/size whitelist (10 MB, pdf/png/jpg/xlsx/dwg); XLSX parsed with formulas disabled.
- **Storage:** private buckets; signed URLs (60 min); path convention `entity/{type}/{id}/…`.
- **Public link:** unguessable `public_token` (uuid v4), read-only projection (no internal notes/costs), revocable, rate-limited, optional expiry with quotation validity.
- **Secrets:** Vercel env vars; service-role key server-only (never client); Resend domain SPF/DKIM.
- **Headers:** CSP, HSTS, X-Frame-Options deny (except `/q/*` self), CSRF-safe (same-site cookies + route origin check).
- **Audit & sessions:** login history, active-session list on profile, admin force-logout; audit before/after on all business tables (trigger).
- **Backups & recovery** — §18; **rate limiting** on auth, search, public routes (Vercel middleware + upstash-style counter or Supabase edge).

---

# 18. Backup Strategy

| Layer | Mechanism | Frequency / retention |
|---|---|---|
| Postgres | Supabase automated backups + **PITR** (Pro plan) | daily snapshot, 30-day retention; PITR ≤ 5 min RPO |
| Off-platform copy | `pg_dump` via scheduled GitHub Action → encrypted → private storage (S3/Backblaze) | weekly, 12 weeks + monthly, 12 months |
| Storage files | Supabase Storage replicate via scheduled sync job to second bucket/provider | weekly |
| Config | `settings`, roles, templates included in dumps; infra as code in repo | every deploy |
| App code | GitHub (source of truth) + tags per release | — |
| Restore drills | Quarterly restore-to-staging test, documented runbook | RTO ≤ 4 h |
| User-level safety | Soft delete + audit old_data JSON → per-record "restore" by admin | 90 days |

---

# 19. Deployment Architecture

```
GitHub repo (quotation-app)
  ├─ branch: main ────► Vercel Production ── quotation.alfarooque.com
  ├─ branch: develop ─► Vercel Preview (staging) ── quotation-staging.vercel.app
  └─ PRs ─────────────► Vercel Preview URLs + CI (lint, typecheck, unit, e2e-smoke)

Supabase
  ├─ project: quotation-prod  (DB + Auth + Storage + Edge Functions + pg_cron)
  └─ project: quotation-staging (seeded with anonymized sample data)
Migrations: supabase CLI, versioned in repo, applied via CI step (staging auto, prod manual approve)
Email: Resend (domain alfarooque.com, dedicated templates)
DNS: CNAME quotation.alfarooque.com → Vercel; env vars per environment
Monitoring: Vercel analytics + logs; Supabase log drains; Sentry (errors, both client/server)
```

Release process: PR → preview → merge develop (staging) → QA checklist → merge main → tag → prod migration approval → smoke test.

---

# 20. Performance Strategy

- **DB:** indexes per §11; keyset pagination; `recalc_quotation` as single RPC (no chatty writes); materialized view `mv_dashboard_stats` refreshed by cron (5 min) for KPI cards; trigram search limited + ranked; connection pooling (Supabase pgbouncer).
- **App:** RSC streaming for lists; `next/dynamic` for heavy client chunks (PDF preview, charts, import wizard); virtualized tables (>100 rows); debounced search; optimistic UI on line edits (engine runs client-side, server confirms).
- **Assets:** next/image + Supabase image transforms for thumbnails; fonts self-hosted subsetted (Arabic subset).
- **Caching:** TanStack Query cache; route-segment revalidation for masters (revalidateTag on mutation); CDN for public `/q/*` with short TTL.
- **PDF:** generate on demand, cache generated file per quotation version in Storage (invalidate on change).
- **Budgets:** LCP < 2.5 s, editor TTI < 3 s, bundle (editor route) < 350 kB gz; CI lighthouse check.

---

# 21. Import/Export & Data Migration Plan

## 21.1 Importers (all: upload → auto-map → validate → dry-run report → commit as background job → error xlsx)
| Importer | Source format | Mapping |
|---|---|---|
| **Purchases → Materials & Price History** | *Purchases Products Report* (ID, Date, Reference No, Supplier, Product Code, Product Name, Quantity, Unit, Unit cost, Tax, Discount, Total, Payment Status, Status) | match material by Product Code else name; create if new (kind guessed by category rules); append price_history(source='purchase_report', effective_date=Date, supplier); upsert supplier by Arabic name; update latest_price if newer |
| **Customers** | *WW-03 Customer Details.xlsx* (#, Company Name, Customer Name, Contact Number) | dedupe by normalized phone; type guess (فندق→Hotel, شركة→Contractor, مهندس→Engineer) |
| **Catalogue** | *Standard Price List* sheet (Category, Product, Description, Price, Unit) | upsert by name+category |
| **Materials master** | generic template (downloadable) | full column set |
| **Labour/Expenses** | generic templates | — |

## 21.2 Exports
Every list → xlsx/csv (respecting filters & permissions — cost columns stripped without `costs.view`); quotation register; VAT report; full material master; PDF batch export of selected quotations.

## 21.3 Migration sequence (go-live)
1. Seed entities, roles, settings, units, categories, terms.
2. Import customers (280) → review dedupe.
3. Import purchases report → materials (~800–1,200 uniques expected) + price history (2,421 pts) + suppliers.
4. Enter labour roles & machine rates (small set, manual).
5. Import standard price list → catalogue (≈50 products).
6. Recreate 3–5 recent real quotations as UAT validation against Excel results (totals must match to the halala).

---

# 22. Future Expansion Plan

| Phase | Capability |
|---|---|
| E1 | **Invoicing + ZATCA Phase-2 e-invoicing** (QR, XML, integration portal), pro-forma from quotation |
| E2 | **Purchase Orders & Purchase Requests** (digitize the PR logbooks), supplier RFQ comparison |
| E3 | **Inventory** (stock levels in مخزن المصنع, reserve on accepted quotation, consumption vs estimate) |
| E4 | **Production module**: job cards from accepted quotations, machine scheduling, evaluation templates digitized |
| E5 | **Customer portal**: view/accept/e-sign quotations online |
| E6 | **Costing intelligence**: actual-vs-quoted cost feedback, price suggestion from history, AI-assisted BOM from drawings |
| E7 | **Mobile app** (approvals, site measurements, photos) |
| E8 | Accounting integration (QuickBooks/Zoho/Odoo) and payroll link to attendance sheets |
Architecture accommodates these now: entity scoping, polymorphic attachments, event log, catalogue/product cost separation, status machine extensible.

---

# 23. Implementation Roadmap (for Claude Code)

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 Foundation** | Repo scaffold matching existing apps, CI, Supabase project, migrations for entities/settings/RBAC/profiles, auth, app shell, dark mode, i18n EN/AR + RTL, sidebar/topbar, command palette shell | login → empty dashboard, both languages, deployed to staging |
| **P1 Master data** | Customers, Suppliers, Projects, Materials+Hardware (+categories, price history, favorites/recents), Labour, Machines, Expenses; DataTable, filters, saved views; audit triggers | CRUD + search + history all green; customer & purchases importers |
| **P2 Catalogue & costing engine** | catalogue_products + cost model editor, pure costing lib (unit-tested against §9 examples), recost, duplicate | product cost = hand-calculated Excel parity |
| **P3 Quotation core** | Quotation editor (both modes), autosave, summary calc, revisions, duplicate, statuses w/o approval, attachments | create→draft→approved(auto)→numbers correct |
| **P4 Approval, PDF, send** | Threshold engine, approvals UI+notifications, PDF (AR/EN, per entity), Resend email, public link, expiry cron | end-to-end lifecycle demo |
| **P5 Dashboards & reports** | Dashboard KPIs, analytics boards, reports + exports, VAT report | manager sign-off |
| **P6 Admin & hardening** | User mgmt UI, settings screens, audit viewer, import/export centre, bulk ops, shortcuts, RLS review, rate limits, Sentry, backups job, perf budgets | security checklist + restore drill pass |
| **P7 Migration & UAT** | §21.3 sequence, parallel-run 2 weeks, training | 5 real quotations reproduced exactly; go-live |

Each phase = separate PR set, testable and committed independently (as requested; the detailed build prompt will be produced in the follow-up document `Claude_Code_Implementation_Prompt.md`).

---

# 24. Appendix A — Screen Inventory Checklist

Dashboard ✅ (§8) · Customers ✅ (7.6) · Projects ✅ (7.7) · Quotations ✅ (7.3/7.4) · Products/Catalogue ✅ (7.8) · Product Costing ✅ (7.8/7.4) · Materials ✅ (7.9) · Material Master ✅ (7.9) · Hardware ✅ (7.9/FR-MAT-9) · Labour ✅ (7.10) · Machines ✅ (7.10) · Expenses ✅ (7.10) · Profit Settings ✅ (7.13) · VAT Settings ✅ (7.13) · Reports ✅ (7.12) · PDF Preview ✅ (7.5) · User Management ✅ (7.13) · Settings ✅ (7.13) · Activity Logs ✅ (7.13) · Audit Logs ✅ (7.13) · Import/Export ✅ (7.13/§21) · Analytics ✅ (8.3) · Search ✅ (FR-UX-1) · Notifications ✅ (7.13) · Profile ✅ (7.13) · Suppliers ✅ (7.11) · Public quotation view ✅ (§12).

# 25. Appendix B — Confirmed Design Decisions

1. **Language:** Bilingual EN/AR UI with full RTL; bilingual data fields; PDF in either language.
2. **Approval:** Yes — Draft → Review → Approved → Sent with thresholds (amount / margin / discount, configurable).
3. **Quote modes:** Both — Quick Quote from catalogue **and** Detailed Costing; costed products publishable to catalogue.
4. **Entities:** Multi-entity (Alfarooque Wood Works Factory + Ismail Al Farooque General Contracting) — per-entity branding, numbering, CR/VAT.
5. Currency SAR; VAT 15%; jurisdiction Saudi Arabia (ZATCA e-invoicing reserved for expansion E1).

---
*End of Quotation System Master Specification. Next step: request the companion document `Claude_Code_Implementation_Prompt.md` to generate the phased build instructions for Claude Code.*
