

# Recommended Enhancements for KwikDry Owner Portal

## 1. Payroll CSV/PDF Export
Currently there's no way to download or export payroll data. Add a "Download CSV" and "Download PDF" button to the payroll page so reports can be shared with accountants or saved for records.

**Scope**: Add export buttons to `PayrollReports.tsx` that generate a CSV (client-side) and optionally a PDF summary.

---

## 2. Automated HCP Sync (Cron Job)
The HCP data sync currently requires a manual button press. Set up a Supabase cron job (via `pg_cron` or a scheduled Edge Function invocation) to auto-sync HCP data every 15-30 minutes, so job changes, tips, and payment data stay current without manual intervention.

**Scope**: Configure `supabase/config.toml` with a cron schedule that calls `sync-hcp-data` with `syncAll=true`.

---

## 3. Technician-Facing Pay Stub View
Technicians currently have no visibility into their own pay. Add a "My Pay" section to the technician dashboard or settings page showing their weekly earnings breakdown (jobs, tips, CC fees, net pay) — read-only, using the same payroll logic.

**Scope**: New component under `/settings` or `/dashboard` for technician role, querying `hcp_jobs` filtered to their `technician_hcp_id`.

---

## 4. In-App Notification Center
Push notifications exist but there's no in-app notification bell/inbox. The `notification_log` table already stores notifications. Add a bell icon in the header with an unread count badge and a dropdown showing recent notifications.

**Scope**: New `NotificationBell` component in `AppHeader.tsx`, querying `notification_log` for the current user, with mark-as-read support.

---

## 5. Payroll Date Range Totals & YTD Summary
Add a year-to-date or month-to-date summary card on the payroll page showing cumulative earnings per technician. Useful for tax planning and performance tracking.

**Scope**: Additional summary card in `PayrollReports.tsx` with a broader date query.

---

## 6. Equipment Maintenance Reminders
Equipment maintenance records exist but there's no proactive alerting. Add dashboard alerts or push notifications when `next_due` dates are approaching (e.g., within 7 days).

**Scope**: Dashboard query for upcoming maintenance + optional push notification via a new Edge Function or extending the existing sync.

---

## 7. Checklist Compliance Dashboard Improvements
The compliance data exists (`technician_checklist_compliance` view) but could be surfaced more prominently. Add a visual compliance heatmap or streak tracker showing which technicians consistently submit daily/weekly checklists.

**Scope**: New visualization component in the admin dashboard or checklists page.

---

## 8. Inventory Reorder Alerts
Low-stock items are shown on the admin dashboard, but there's no automated notification. Send push or email alerts when items drop below `reorder_threshold`.

**Scope**: Extend `send-inventory-notifications` Edge Function to trigger on stock changes, or add a cron check.

---

## Priority Recommendation

| Priority | Enhancement | Impact |
|----------|------------|--------|
| High | Automated HCP Sync | Eliminates manual sync, keeps data fresh |
| High | Payroll CSV Export | Immediate business need for accounting |
| Medium | In-App Notification Center | Better UX for existing push system |
| Medium | Technician Pay Stub View | Transparency, reduces admin questions |
| Medium | Equipment Maintenance Reminders | Prevents missed maintenance |
| Lower | YTD Payroll Summary | Nice-to-have reporting |
| Lower | Checklist Compliance Heatmap | Visual improvement |
| Lower | Inventory Reorder Alerts | Extends existing low-stock logic |

