

# Feature 1: Technician Payroll & Commission Tracking

## Overview
An admin-only Payroll page that calculates what each technician is owed for a given period, supporting two pay models simultaneously: flat salary + tips - CC fees, or percentage commission - CC fees + tips - CC fees.

## How It Works

### Per-Technician Pay Configuration
Each technician gets a pay model setting stored in a new `technician_pay_config` table:
- **Salary model**: Base weekly amount (e.g., $1,000/week) + tips earned - CC fees on tips
- **Commission model**: Commission percentage (e.g., 40%) applied to job revenue - CC fees + tips - CC fees on tips
- CC fees are calculated as a **flat percentage** configured at the organization level (stored in `organizations.settings` JSON, e.g., `{ "cc_fee_percent": 3 }`)

Admins can set/change each tech's pay model from the payroll page or from the user management detail view.

### Payroll Report Page (`/payroll`)
- **Date selection**: Weekly pay period picker (Mon-Sun or configurable) + custom date range option
- **Summary view**: Table showing each technician with columns for: jobs completed, gross revenue, CC fees (calculated), tips, net pay
- **Expandable detail**: Click a technician row to see individual job breakdown (customer, date, amount, tip, CC fee, net)
- Pulls from existing `hcp_jobs` table (already has `total_amount`, `tip_amount`, `status`, `technician_hcp_id`)

### CC Fee Calculation
Since you want a flat percentage rather than actual HCP processing fees:
- Org-level setting: `cc_fee_percent` (e.g., 3.0)
- Applied to each job's `total_amount` and `tip_amount` when `payment_method` contains "card" or similar
- Cash/check payments: no CC fee deducted

## Database Changes

**New table: `technician_pay_config`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| profile_id | uuid | FK to profiles |
| organization_id | uuid | FK to organizations |
| pay_model | text | 'salary' or 'commission' |
| weekly_salary | numeric | For salary model |
| commission_percent | numeric | For commission model (e.g., 40) |
| effective_date | date | When this config takes effect |
| created_at | timestamptz | |

**Organization settings update**: Add `cc_fee_percent` to `organizations.settings` JSON (no schema change needed).

## Files to Create/Edit
| File | Action |
|------|--------|
| DB migration | New `technician_pay_config` table + RLS |
| `src/pages/admin/PayrollReports.tsx` | New page |
| `src/hooks/usePayrollReport.ts` | Data hook - queries hcp_jobs + pay config |
| `src/App.tsx` | Add `/payroll` route |
| `src/config/navigation.ts` | Add nav item |

---

# Feature 2: HCP Job Activity Feed & Change Notifications

## Overview
Detect when jobs get cancelled or rescheduled in HouseCall Pro and surface those changes as an in-app activity feed with push notifications for admins.

## How It Works

### Change Detection (during HCP sync)
The existing `sync-hcp-data` edge function already upserts jobs. We modify it to:
1. Before upserting each job, read the existing record from `hcp_jobs`
2. Compare key fields: `status`, `scheduled_date`, `scheduled_time`, `technician_hcp_id`
3. If a meaningful change is detected, insert a record into a new `job_change_events` table

### What Gets Tracked
- **Cancellations**: status changed to `cancelled`/`canceled`
- **Reschedules**: `scheduled_date` or `scheduled_time` changed
- **Technician reassignment**: `technician_hcp_id` changed

### Activity Feed Page (`/activity`)
- Chronological list of change events, most recent first
- Each card shows: job customer name, what changed (old → new), when detected
- Click through to the job on the job map or open in HCP
- Filter by change type (cancellation, reschedule, reassignment)
- Mark as read / dismiss

### Push Notifications
- When a change event is created, send a push notification to all admin users in the organization
- Reuses the existing Firebase Cloud Messaging infrastructure
- Notification click opens the activity feed

## Database Changes

**New table: `job_change_events`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | |
| hcp_job_id | text | |
| change_type | text | 'cancelled', 'rescheduled', 'reassigned' |
| old_value | jsonb | Previous field values |
| new_value | jsonb | New field values |
| customer_name | text | Denormalized for feed display |
| detected_at | timestamptz | When sync found the change |
| is_read | boolean | Default false |
| read_by | uuid | Profile ID |

## Files to Create/Edit
| File | Action |
|------|--------|
| DB migration | New `job_change_events` table + RLS |
| `supabase/functions/sync-hcp-data/index.ts` | Add change detection before upsert |
| `supabase/functions/send-job-change-notifications/index.ts` | New edge function for push alerts |
| `src/pages/admin/ActivityFeed.tsx` | New page |
| `src/hooks/useActivityFeed.ts` | Data hook |
| `src/App.tsx` | Add `/activity` route |
| `src/config/navigation.ts` | Add nav item |
| `src/components/dashboard/AdminDashboard.tsx` | Add unread changes count card |

