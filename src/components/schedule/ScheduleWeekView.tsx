import { useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { getStatusColor, normalizeStatus } from "@/hooks/useSchedule";
import type { HCPJob } from "@/hooks/useJobMap";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  jobs: HCPJob[];
  onJobClick: (job: HCPJob) => void;
  onDayClick: (d: Date) => void;
}

export function ScheduleWeekView({ date, jobs, onJobClick, onDayClick }: Props) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const jobsByDay = useMemo(() => {
    const map = new Map<string, HCPJob[]>();
    days.forEach((d) => map.set(format(d, "yyyy-MM-dd"), []));
    jobs.forEach((j) => {
      if (!j.scheduled_date) return;
      const arr = map.get(j.scheduled_date);
      if (arr) arr.push(j);
    });
    return map;
  }, [jobs, days]);

  return (
    <div className="grid grid-cols-7 gap-px bg-border min-h-[60vh]">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const list = jobsByDay.get(key) ?? [];
        const isToday = isSameDay(d, new Date());
        return (
          <div key={key} className="bg-background flex flex-col min-h-[300px]">
            <button
              onClick={() => onDayClick(d)}
              className={cn(
                "px-2 py-2 text-left border-b hover:bg-accent/40 transition-colors",
                isToday && "bg-primary/5",
              )}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {format(d, "EEE")}
              </div>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-2xl font-semibold", isToday && "text-primary")}>
                  {format(d, "d")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {list.length} {list.length === 1 ? "job" : "jobs"}
                </span>
              </div>
            </button>
            <div className="flex-1 p-1.5 space-y-1 overflow-auto">
              {list.slice(0, 6).map((j) => {
                const color = getStatusColor(j.status);
                return (
                  <button
                    key={j.id}
                    onClick={() => onJobClick(j)}
                    className="w-full text-left px-1.5 py-1 rounded text-xs hover:bg-accent/60 transition-colors border-l-2 bg-card"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {j.scheduled_time && (
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {j.scheduled_time.slice(0, 5)}
                        </span>
                      )}
                      <span className="truncate font-medium">
                        {j.customer_name ?? "Unknown"}
                      </span>
                    </div>
                    {j.technician_name && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {j.technician_name}
                      </div>
                    )}
                  </button>
                );
              })}
              {list.length > 6 && (
                <button
                  onClick={() => onDayClick(d)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
                >
                  +{list.length - 6} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
