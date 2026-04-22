import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { JobBlock } from "./JobBlock";
import { useTechnicians } from "@/hooks/useJobMap";
import { useUpdateScheduleJob } from "@/hooks/useSchedule";
import type { HCPJob } from "@/hooks/useJobMap";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 56; // px per hour
const START_HOUR = 6;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface Props {
  date: Date;
  jobs: HCPJob[];
  onJobClick: (job: HCPJob) => void;
  canEdit: boolean;
}

interface ColumnDef {
  key: string; // hcp_employee_id or 'unassigned'
  label: string;
}

export function ScheduleDayView({ date, jobs, onJobClick, canEdit }: Props) {
  const { data: technicians = [] } = useTechnicians();
  const updateJob = useUpdateScheduleJob();

  const dayJobs = useMemo(
    () => jobs.filter((j) => j.scheduled_date === format(date, "yyyy-MM-dd")),
    [jobs, date],
  );

  // Build columns: only technicians with jobs today + always show "Unassigned" if any
  const columns: ColumnDef[] = useMemo(() => {
    const techIds = new Set(
      dayJobs.map((j) => j.technician_hcp_id).filter((id): id is string => !!id),
    );
    const cols: ColumnDef[] = technicians
      .filter((t) => techIds.has(t.id))
      .map((t) => ({ key: t.id, label: t.name }));

    // Add any techs that have jobs but aren't in the technicians list
    const knownIds = new Set(cols.map((c) => c.key));
    dayJobs.forEach((j) => {
      if (j.technician_hcp_id && !knownIds.has(j.technician_hcp_id)) {
        cols.push({ key: j.technician_hcp_id, label: j.technician_name ?? "Technician" });
        knownIds.add(j.technician_hcp_id);
      }
    });

    // Always include unassigned column if there are unassigned jobs OR if no other cols
    const hasUnassigned = dayJobs.some((j) => !j.technician_hcp_id);
    if (hasUnassigned || cols.length === 0) {
      cols.push({ key: "unassigned", label: "Unassigned" });
    }
    return cols;
  }, [dayJobs, technicians]);

  // Daily totals
  const totals = useMemo(() => {
    const revenue = dayJobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0);
    return { count: dayJobs.length, revenue };
  }, [dayJobs]);

  // Group jobs by column key
  const jobsByCol = useMemo(() => {
    const map = new Map<string, HCPJob[]>();
    columns.forEach((c) => map.set(c.key, []));
    dayJobs.forEach((j) => {
      const key = j.technician_hcp_id ?? "unassigned";
      const arr = map.get(key) ?? [];
      arr.push(j);
      map.set(key, arr);
    });
    return map;
  }, [columns, dayJobs]);

  // Detect conflicts per column
  const conflictIds = useMemo(() => {
    const out = new Set<string>();
    for (const [, arr] of jobsByCol) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (overlap(arr[i], arr[j])) {
            out.add(arr[i].id);
            out.add(arr[j].id);
          }
        }
      }
    }
    return out;
  }, [jobsByCol]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!canEdit) return;
    const job = e.active.data.current?.job as HCPJob | undefined;
    const overId = e.over?.id as string | undefined;
    if (!job || !overId || !overId.startsWith("slot-")) return;

    // slot-{colKey}-{hour}-{minute}
    const parts = overId.split("-");
    const minute = parseInt(parts[parts.length - 1], 10);
    const hour = parseInt(parts[parts.length - 2], 10);
    const colKey = parts.slice(1, parts.length - 2).join("-");

    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    const newTime = `${hh}:${mm}`;

    // Calculate new end keeping duration
    const dur = jobDurationMinutes(job);
    const endTotal = hour * 60 + minute + dur;
    const eh = String(Math.floor(endTotal / 60)).padStart(2, "0");
    const em = String(endTotal % 60).padStart(2, "0");
    const newEnd = `${eh}:${em}`;

    const technicianHcpId = colKey === "unassigned" ? undefined : colKey;

    updateJob.mutate({
      hcpJobId: job.hcp_job_id,
      scheduledDate: format(date, "yyyy-MM-dd"),
      scheduledTime: newTime,
      scheduledEnd: newEnd,
      ...(technicianHcpId ? { technicianHcpId } : {}),
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Daily totals strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/20 text-sm">
        <span className="font-medium">{format(date, "EEEE, MMMM d")}</span>
        <span className="text-muted-foreground">
          {totals.count} {totals.count === 1 ? "job" : "jobs"}
        </span>
        <span className="text-muted-foreground">
          ${totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue
        </span>
      </div>

      <div className="overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(${columns.length}, minmax(180px, 1fr))`,
            minWidth: 64 + columns.length * 180,
          }}
        >
          {/* Header row */}
          <div className="sticky top-0 bg-background border-b border-r z-10" />
          {columns.map((c) => (
            <div
              key={c.key}
              className="sticky top-0 bg-background border-b z-10 px-3 py-2 text-sm font-medium truncate"
            >
              {c.label}
              <span className="ml-2 text-xs text-muted-foreground">
                {jobsByCol.get(c.key)?.length ?? 0}
              </span>
            </div>
          ))}

          {/* Time gutter + columns */}
          <div className="border-r relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[11px] text-muted-foreground pr-2 text-right border-b"
                style={{ height: HOUR_HEIGHT }}
              >
                {format(new Date(2000, 0, 1, h), "h a")}
              </div>
            ))}
          </div>

          {columns.map((col) => (
            <DayColumn
              key={col.key}
              colKey={col.key}
              jobs={jobsByCol.get(col.key) ?? []}
              conflictIds={conflictIds}
              onJobClick={onJobClick}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function DayColumn({
  colKey,
  jobs,
  conflictIds,
  onJobClick,
  canEdit,
}: {
  colKey: string;
  jobs: HCPJob[];
  conflictIds: Set<string>;
  onJobClick: (job: HCPJob) => void;
  canEdit: boolean;
}) {
  return (
    <div className="relative border-r">
      {HOURS.map((h) => (
        <div key={h} className="border-b" style={{ height: HOUR_HEIGHT }}>
          <DropSlot colKey={colKey} hour={h} minute={0} />
          <DropSlot colKey={colKey} hour={h} minute={30} bottom />
        </div>
      ))}
      {jobs.map((job) => {
        const pos = jobToBlockPosition(job);
        if (!pos) {
          // Unscheduled time but assigned: show at top
          return (
            <div key={job.id} className="absolute left-1 right-1 top-1">
              <JobBlock
                job={job}
                onClick={onJobClick}
                draggable={canEdit}
                conflict={conflictIds.has(job.id)}
              />
            </div>
          );
        }
        return (
          <div
            key={job.id}
            className="absolute left-1 right-1"
            style={{ top: pos.top, height: Math.max(pos.height, 36) }}
          >
            <JobBlock
              job={job}
              onClick={onJobClick}
              draggable={canEdit}
              conflict={conflictIds.has(job.id)}
              style={{ height: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}

function DropSlot({
  colKey,
  hour,
  minute,
  bottom,
}: {
  colKey: string;
  hour: number;
  minute: number;
  bottom?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${colKey}-${hour}-${minute}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-1/2 transition-colors",
        bottom ? "border-t border-dashed border-muted/40" : "",
        isOver && "bg-primary/10",
      )}
    />
  );
}

function parseHM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
}

function jobDurationMinutes(job: HCPJob): number {
  const start = parseHM(job.scheduled_time);
  const end = parseHM(job.scheduled_end);
  if (!start || !end) return 60;
  const dur = end.h * 60 + end.m - (start.h * 60 + start.m);
  return dur > 0 ? dur : 60;
}

function jobToBlockPosition(job: HCPJob): { top: number; height: number } | null {
  const start = parseHM(job.scheduled_time);
  if (!start) return null;
  const end = parseHM(job.scheduled_end);
  const startMin = start.h * 60 + start.m - START_HOUR * 60;
  const endMin = end ? end.h * 60 + end.m - START_HOUR * 60 : startMin + 60;
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
  return { top, height };
}

function overlap(a: HCPJob, b: HCPJob): boolean {
  const as = parseHM(a.scheduled_time);
  const bs = parseHM(b.scheduled_time);
  if (!as || !bs) return false;
  const ae = parseHM(a.scheduled_end) ?? { h: as.h + 1, m: as.m };
  const be = parseHM(b.scheduled_end) ?? { h: bs.h + 1, m: bs.m };
  const aStart = as.h * 60 + as.m;
  const aEnd = ae.h * 60 + ae.m;
  const bStart = bs.h * 60 + bs.m;
  const bEnd = be.h * 60 + be.m;
  return aStart < bEnd && bStart < aEnd;
}
