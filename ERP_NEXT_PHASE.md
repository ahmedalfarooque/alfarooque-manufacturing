# ERP Next Phase — Phase 4: HR & Payroll

## Overview

Phase 4 builds the HR & Payroll module at `localhost:3100` (`hr.alfarooque.com`).
All patterns established in Accounting and CRM apply directly.

## Database Tables Needed (`hr_*` prefix)

```sql
-- Core employee data
hr_employees          -- id, employee_number, full_name, full_name_ar, nationality,
                      --   iqama_number, passport_number, dob, hire_date, department_id,
                      --   position_id, manager_id, status, bank_iban, photo_url

hr_departments        -- id, name, name_ar, manager_id, cost_center
hr_positions          -- id, title, title_ar, department_id, grade, salary_band_min, salary_band_max

-- Attendance & time
hr_attendance         -- id, employee_id, date, check_in, check_out, hours_worked, source
hr_leave_types        -- id, name, days_per_year, is_paid, carry_forward_days
hr_leave_requests     -- id, employee_id, leave_type_id, from_date, to_date, days, status, approved_by

-- Payroll
hr_payroll_runs       -- id, period_month, period_year, status, total_gross, total_deductions, total_net
hr_payroll_lines      -- id, run_id, employee_id, basic_salary, housing, transport, other_allowances,
                      --   gosi_employee, gosi_employer, income_tax, other_deductions, net_pay
hr_salary_structures  -- id, position_id, basic, housing_pct, transport_pct, effective_from

-- Compliance
hr_gosi_submissions   -- id, period, submission_date, file_url, status
hr_wps_exports        -- id, period, created_at, file_url, total_amount, employee_count
```

## API Routes to Build

```
/api/employees          GET (list, search, dept filter) + POST
/api/employees/[id]     GET (profile + leave balance + payslips) + PATCH + DELETE
/api/departments        GET + POST + PATCH + DELETE
/api/positions          GET + POST
/api/attendance         GET (date range, employee filter) + POST (manual entry)
/api/attendance/import  POST (CSV/Excel import)
/api/leave-requests     GET (my requests / all) + POST
/api/leave-requests/[id] PATCH (approve/reject) + DELETE
/api/payroll/run        POST (generate payroll for period)
/api/payroll/[runId]    GET (lines + totals) + PATCH (approve/finalize)
/api/payroll/payslip/[id] GET (single employee PDF)
/api/payroll/wps        POST (generate WPS SIF file for Saudi banks)
/api/gosi               GET (rates) + POST (submit)
/api/hr/reports         GET (headcount, turnover, leave utilization, salary costs)
/api/hr/settings        GET + PATCH
```

## Pages to Build

```
/dashboard          Headcount, payroll cost, leave pending, upcoming renewals
/employees          List with dept/status filter + add employee modal
/employees/[id]     Profile: personal info, documents, leave balance, payslip history
/attendance         Date-grid view + import CSV + manual entry
/leave              Leave request list + approve/reject actions
/payroll            Payroll runs list + generate new run
/payroll/[id]       Payroll run detail: all employee lines, totals, approve button
/gosi               GOSI rates + submission history
/reports            Headcount, turnover, salary distribution, leave utilization
/settings           Company GOSI number, payroll cut-off day, leave rules
```

## Saudi Compliance Requirements

- **GOSI**: 9% employee + 9% employer (Saudi nationals); 2% employer only (expatriates)
- **WPS**: Wage Protection System SIF file format for banks (IBAN, amount, employee ID)
- **Iqama**: Expiry tracking with 60-day advance alert
- **End of Service**: EOSB calculation per Saudi labor law (1/3 month per year first 5 years, 1 month per year thereafter)
- **Annual Leave**: 21 days first 5 years, 30 days after
- **Haj Leave**: 10 days once per employment (Muslims only)

## Implementation Order

1. Database schema + seed data (departments, positions)
2. App scaffold (copy from CRM: package.json, lib/*, middleware.js, components/*)
3. Employees CRUD (most foundational)
4. Attendance tracking
5. Leave management
6. Payroll calculation engine (Saudi-specific rules)
7. WPS export
8. Reports
9. GOSI integration

## Estimated Effort

- API routes: ~15 routes
- Pages: ~10 pages
- Saudi-specific logic: payroll calculation, WPS format, EOSB

## Notes

- Reuse identical auth pattern (OTP + SSO), glass design system, and useLiveData hook
- `hr_user_roles` table for app-specific role override (same pattern as acc/crm)
- Payslip PDF via `jsPDF` or server-side html→pdf (same pattern as Quotation app)
- Do NOT build HR until Phases 1-3 are fully live and tested in production
