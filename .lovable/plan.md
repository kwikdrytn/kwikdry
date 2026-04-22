

## Schedule Page (HCP-style)

A new `/schedule` route that mirrors HouseCall Pro's scheduling experience — letting admins/call staff view, filter, and edit jobs across day/week views, all driven by the existing `hcp_jobs` data and the working `update-hcp-job` edge function.

### Layout

```text
┌─────────────────────────────────────────────────────────────────┐
│ Schedule                              [Day] [Week] [List]  ← →  │
│ Mon, Apr 22  │  Filters: Tech ▾  Status ▾  Service ▾  Search 🔍 │
├──────────┬──────────────────────────────────────────────────────┤
│ Time     │ Tech A          │ Tech B          │ Unassigned       │
│ 8 AM     │ ┌────────────┐  │                 │                  │
│ 9 AM     │ │ Smith - CR │  │ ┌───────────┐   │                  │
│ 10 AM    │ │ 9:00–11:00 │  │ │ Jones-Tile│   │                  │
│ 11 AM    │ └────────────┘  │ └───────────┘   │                  │
│ 12 PM    │                 │                 │ ┌─────────────┐  │
│ ...      │                 │                 │ │ Pending job │  │
└──────────┴──────────────────────────────────────────────────────┘
                              ▲ click any block → Job Details panel
```

### Three views

1. **Day view** — vertical timeline (6 AM–8 PM), one column per technician + an "Unassigned" column. Job blocks sized by duration, color-coded by status.
2. **Week view** — 7-day grid, each cell shows a stacked count + mini job chips per tech.
3. **List view** — sortable table (date, time, customer, tech, services, status, amount) for quick scanning and bulk triage.

### Job details panel

Clicking any job opens a slide-out side panel (right side, 480px) showing:

- Customer name, address (with map link), phone (click-to-call)
- Schedule, technician, status (all editable inline)
- Services & line items with prices, total amount
- Notes (append-only history) + add-note field
- Payment status, tip, CC fee (read-only from sync)
- Buttons: **Save changes**, **Open in HCP**, **View on Map**

Editing reuses the existing `update-hcp-job` edge function — no new backend work needed.

### Filters & search

- Technician multi-select (with "Unassigned")
- Status multi-select (Scheduled / In Progress / Completed / Cancelled)
- Service type multi-select (from `hcp_services`)
- Free-text search (customer name, address, job ID)
- Date picker + Today / ← → arrows
- URL-synced filters (shareable links, same pattern as Job Map)

### Suggested additions

- **Drag-to-reschedule** in Day view — drag a job block to a new time slot or different tech column → calls `update-hcp-job`. Big productivity win vs. opening a dialog every time.
- **"Sync Now" button** — invokes `sync-hcp-data` so users can pull fresh HCP data on demand instead of waiting for the cron.
- **Unscheduled queue** — collapsible panel listing jobs without a `scheduled_date` (drafts/needs-scheduling) so they're not lost.
- **Conflict warnings** — highlight overlapping jobs for the same tech in red.
- **Daily totals strip** — top of Day view shows: # jobs, total revenue, jobs per tech.
- **Print / export day** — print-friendly version of the day's schedule for techs without smartphones.
- **Quick-create** — "+ New Job" button opens the existing booking flow (reuse `BookingSuggestionPanel` logic or a simpler form) → creates via `create-hcp-job`.

### Permissions

- Add new permission `schedule.view` (admin + call_staff by default).
- Editing requires `schedule.edit` (admin + call_staff).
- Reuses existing `RoleGuard` pattern.

### Files to create

- `src/pages/Schedule.tsx` — page shell with view tabs and `DashboardLayout`.
- `src/components/schedule/ScheduleDayView.tsx` — timeline grid.
- `src/components/schedule/ScheduleWeekView.tsx` — 7-day grid.
- `src/components/schedule/ScheduleListView.tsx` — sortable table.
- `src/components/schedule/JobBlock.tsx` — draggable job card.
- `src/components/schedule/JobDetailsPanel.tsx` — slide-out editor (Sheet component).
- `src/components/schedule/ScheduleFilters.tsx` — filter bar.
- `src/components/schedule/UnscheduledQueue.tsx` — collapsible draft list.
- `src/hooks/useSchedule.ts` — queries (`useScheduleJobs`, `useScheduleTechnicians`) reusing existing `hcp_jobs` patterns.

### Files to update

- `src/App.tsx` — add `/schedule` route guarded by `schedule.view`.
- `src/config/navigation.ts` — add "Schedule" nav item with calendar icon.
- `src/hooks/useRoles.ts` — register `schedule.view` and `schedule.edit` permissions.
- Database migration — add the two permission keys to the enum + grant to admin/call_staff system roles.

### Technical notes

- All data is already in `hcp_jobs` (synced via `sync-hcp-data`). No new tables needed.
- Drag-and-drop via `@dnd-kit/core` (already standard in the React ecosystem; will be added).
- Slide-out panel uses the existing `Sheet` UI component for consistency with the app's dialog patterns.
- Time slots respect the org's location timezone (already stored on `locations.timezone`).
- Optimistic updates on drag-reschedule with rollback on edge-function failure.

### Open questions

1. Should drag-to-reschedule be in v1, or ship view-only first and add drag in v2?
2. Should "Schedule" replace the **Job Map** in the sidebar, sit alongside it, or be merged as a tab inside one "Jobs" page?
3. Do you want technicians to also see *their own* schedule (read-only) on this page, or keep it admin/call_staff only?

