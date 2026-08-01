# ERP Completed Features

## Phase 1 — Inventory App (`localhost:3040`)

- Full inventory management: items, categories, warehouses, transactions
- Stock in/out with warehouse tracking
- Low-stock alerts, supplier management
- PDF printing for item sheets
- Barcode/QR ready item cards
- Reports: stock levels, valuation, movement history
- Cross-app inventory search (shared across Quotation, Projects, Cars)

## Phase 2 — Accounting App (`localhost:3060`)

### Authentication
- OTP-based login with SSO (`af_sso_session`) integration
- Role-based access: admin, accountant, viewer
- `acc_user_roles` table for app-specific role override

### General Ledger
- Chart of Accounts: CRUD with account types (Asset, Liability, Equity, Revenue, Expense)
- Journal Entries: create, post, void; debit/credit line items with account references
- Auto-balance validation

### Accounts Receivable
- Invoices: Draft → Sent → Paid → Cancelled/Overdue workflow
- Customer name, dates, subtotal, tax, total
- Invoice listing with search, status filter, pagination

### Accounts Payable
- Bills: Draft → Unpaid → Paid → Overdue/Partially Paid workflow
- Vendor details, bill lines
- Bill listing with search, status filter, pagination

### Payments
- Receipt payments (incoming) and outgoing payments
- Links to bank accounts, invoices, bills
- Payment history with party name and reference

### Banking
- Bank account management: name, IBAN, account number, currency, balance
- Bank transactions: credit/debit entries per account
- Account selector with live transaction filter

### Expenses
- Employee expense claims: category, amount, receipt date, notes
- Approval workflow: Pending → Approved → Rejected → Paid
- Category-based filtering

### Fixed Assets
- Asset register: purchase cost, depreciation method, useful life
- Book value tracking with accumulated depreciation
- Status: Active, Disposed, Under Maintenance, Fully Depreciated
- Dispose action with date recording

### Financial Reports
- Income Statement (P&L): Revenue − COGS − OpEx = Net Income
- Balance Sheet: Assets vs Liabilities + Equity (2-column layout)
- Cash Flow: inflows and outflows from bank transactions
- VAT Report: output VAT (sales) vs input VAT (purchases) → net payable
- Summary Dashboard: key counts and totals across all modules

### Settings
- Company information (EN + AR)
- VAT number, CR number, address
- Default currency, fiscal year start, VAT rate
- Numbering prefixes for invoices, bills, journal entries

## Phase 3 — CRM App (`localhost:3080`)

### Authentication
- OTP-based login with SSO integration
- Role-based access: admin, manager, sales, viewer
- `crm_user_roles` table for app-specific role override

### Contacts
- Full contact management: Lead, Prospect, Customer, Partner, Supplier
- Fields: name, email, phone, company, position, address, source, notes
- Search across name, email, company, phone
- Contact detail view with linked deals and recent activities

### Deals
- Deal lifecycle: Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost
- Status workflow: Open → Won / Lost / On Hold
- Mark Won / Mark Lost buttons on deal detail
- Fields: title, value, currency, probability, expected close date, description
- Linked contact card on deal detail

### Activities
- Types: Call, Meeting, Email, Demo, Follow-up, Task, Note
- Status: Planned, Completed, Cancelled, No Show
- Mark Complete action directly from list
- Linked to contacts and/or deals
- Type and status filters with pagination

### Pipeline (Kanban)
- Horizontal scrolling kanban board
- Columns per stage with deal count and total value
- Deal cards showing contact, value, probability, expected close
- Color-coded stage headers
- Real-time totals: open deals + pipeline value

### Reports
- Summary Overview: contacts, deals, won/lost, pipeline value, won revenue, activities
- Deals Analysis: by status, by stage, win rate, total value (date range)
- Activities Report: by type, completion rate (date range)

### Settings
- Company name, default currency
- Win probability threshold configuration

## Cross-App Integration

- Inventory search API in Quotation (`/api/inventory-search`)
- Inventory search API in Projects (`/api/inventory-search`)
- Inventory search API in Cars (`/api/inventory-search`)
- SQL schema: `supabase/inv-schema-v02-cross-app.sql`

## Infrastructure

- Monorepo: 6 apps, single Supabase project
- Shared SSO cookie (`af_sso_session`) across all apps
- Service-role key server-side only (never browser-exposed)
- Glass design system consistent across all apps
- `useLiveData` polling hook with configurable intervals
- Both Accounting and CRM build clean (`npx next build` → `✓ Compiled successfully`)
