

# Payroll Reports Feature

## Overview
Add an admin-only Payroll Reports page that shows revenue, tips, and credit card fees per technician, pulled from HouseCall Pro. Admins can filter by weekly pay period or custom date range, and view summary totals with expandable job-level detail.

## What's Needed

### 1. Database Schema Updates
The current `hcp_jobs` table only stores `total_amount`. We need additional columns to track financial details from HCP:

- `tip_amount` (numeric) -- tip collected on the job
- `cc_fee_amount` (numeric) -- credit card processing fee
- `payment_method` (text) -- e.g., "credit_card", "cash", "check"
- `invoice_paid_at` (timestamptz) -- when the invoice was actually paid

### 2. Update HCP Sync Edge Function
Modify `sync-hcp-data/index.ts` to pull the additional financial fields from the HCP API response when syncing jobs. The HCP job object includes `total_amount`, `tip`, and payment-related data that we're currently ignoring.

### 3. New Page: Payroll Reports
Create `src/pages/admin/PayrollReports.tsx` with:

- **Date selectors**: A weekly pay period picker (previous/next week navigation) plus a toggle to switch to custom date range with calendar pickers
- **Summary table**: One row per technician showing:
  - Technician name
  - Number of completed jobs
  - Total revenue
  - Total tips
  - Total CC fees
  - Net revenue (revenue - CC fees)
- **Expandable rows**: Click a technician to see each individual job with date, customer, service, amount, tip, CC fee, and payment method
- **Totals row**: Grand totals across all technicians at the bottom

### 4. Navigation and Routing
- Add route `/payroll` in `App.tsx` with admin-only `RoleGuard`
- Add a new permission key `payroll.view` for granular access control
- Add "Payroll" nav item in `src/config/navigation.ts` with a DollarSign icon

### 5. Data Hook
Create `src/hooks/usePayrollReport.ts` to query `hcp_jobs` filtered by:
- Organization ID
- Date range (scheduled_date between start and end)
- Status = "completed" (only completed jobs count toward payroll)

Group results by `technician_name` / `technician_hcp_id`.

## Technical Details

### Database Migration
```sql
ALTER TABLE hcp_jobs
  ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS invoice_paid_at timestamptz;
```

### Permission Key Addition
Add `'payroll.view'` to the `permission_key` enum and to the `PermissionKey` type in `useRoles.ts`.

### Sync Function Changes
In the job upsert within `sync-hcp-data`, map additional HCP fields:
- `job.tip` or `job.tip_amount` to `tip_amount`
- Credit card fee data (from HCP invoice/payment data) to `cc_fee_amount`
- `job.payment_type` or similar to `payment_method`

### Page Layout
- Uses `DashboardLayout` wrapper (consistent with other admin pages)
- Summary uses the existing `Table` component with `Card` wrappers
- Expandable detail uses `Collapsible` from Radix
- Date pickers use existing `Calendar` and `Popover` components
- Charts: optional bar chart showing revenue by tech using `recharts` (already installed)

### File Changes Summary
| File | Action |
|------|--------|
| `supabase/functions/sync-hcp-data/index.ts` | Edit -- add tip/fee/payment fields to job upsert |
| `src/pages/admin/PayrollReports.tsx` | Create -- new payroll report page |
| `src/hooks/usePayrollReport.ts` | Create -- data fetching hook |
| `src/App.tsx` | Edit -- add `/payroll` route |
| `src/config/navigation.ts` | Edit -- add Payroll nav item |
| `src/hooks/useRoles.ts` | Edit -- add `payroll.view` permission key |
| DB migration | Add columns to `hcp_jobs` + enum value |

