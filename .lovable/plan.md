

# Hybrid Pay Model: Guaranteed Minimum vs Commission

## What Changes

Replace the current two-model system (salary OR commission) with a single hybrid model:

- **Net Pay = max(40% of weekly revenue, $1,000) + tips - CC fees on tips**
- Each week (Mon-Sun) is evaluated independently
- $1,000 minimum and 40% commission rate are org-level settings (same for all techs)
- The "Model" column in the summary table shows which path was used that week: "Commission" if 40% exceeded $1,000, or "Guarantee" if the minimum kicked in

## For Multi-Week Custom Ranges

Each Mon-Sun week within the range is calculated separately, then summed. Example: a 2-week range where week 1 revenue is $2,000 (40% = $800 < $1,000, so guarantee) and week 2 revenue is $4,000 (40% = $1,600 > $1,000, so commission) yields $1,000 + $1,600 = $2,600 base pay.

## Technical Details

### 1. Organization settings (no migration needed)
Store `weekly_minimum` and `commission_percent` in `organizations.settings` JSON alongside `cc_fee_percent`. Default: `{ weekly_minimum: 1000, commission_percent: 40 }`.

### 2. `src/hooks/usePayrollReport.ts`
- Remove per-technician pay config lookup (no more `technician_pay_config` queries)
- Read `weekly_minimum` and `commission_percent` from org settings
- Group each technician's jobs by Mon-Sun week
- Per week: calculate `commissionPay = revenue * commission% / 100`, then `weekBase = max(commissionPay, weeklyMinimum)`
- Sum all weeks for `basePay`, then add `totalTips - ccFeesOnTips`
- Add a field like `guaranteeWeeks` / `commissionWeeks` to show how many weeks hit each path
- Remove `usePayConfigs` and `useUpsertPayConfig` exports (or simplify them)

### 3. `src/pages/admin/PayrollReports.tsx`
- Remove per-technician pay model badge; replace with indicator showing "Guarantee" or "Commission" (or both for multi-week)
- Simplify `PaySettingsDialog`: remove technician selector and salary/commission per-tech fields; keep only org-level fields: weekly minimum ($), commission (%), and CC fee (%)
- Update the expanded job detail description to show: "40% Commission (min $1,000/week) + Tips - CC Fees on Tips"

### 4. `technician_pay_config` table
Leave in place for now (no migration to drop it), just stop querying it.

### Files Modified
| File | Change |
|------|--------|
| `src/hooks/usePayrollReport.ts` | New hybrid calc logic, remove per-tech config |
| `src/pages/admin/PayrollReports.tsx` | Simplified settings dialog, updated display |

