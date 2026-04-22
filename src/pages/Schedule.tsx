import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScheduleFiltersBar } from "@/components/schedule/ScheduleFilters";
import { ScheduleDayView } from "@/components/schedule/ScheduleDayView";
import { ScheduleWeekView } from "@/components/schedule/ScheduleWeekView";
import { ScheduleListView } from "@/components/schedule/ScheduleListView";
import { JobDetailsPanel } from "@/components/schedule/JobDetailsPanel";
import { UnscheduledQueue } from "@/components/schedule/UnscheduledQueue";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  DEFAULT_SCHEDULE_FILTERS,
  ScheduleFilters,
  filtersToParams,
  paramsToFilters,
  useScheduleJobs,
  useSyncHcp,
} from "@/hooks/useSchedule";
import { useHasPermission } from "@/hooks/useRoles";
import type { HCPJob } from "@/hooks/useJobMap";

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = useHasPermission("schedule.edit");
  const sync = useSyncHcp();

  const [filters, setFilters] = useState<ScheduleFilters>(() => ({
    ...DEFAULT_SCHEDULE_FILTERS,
    ...paramsToFilters(searchParams),
  }));

  // Sync URL <- filters
  useEffect(() => {
    setSearchParams(filtersToParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const [selectedJob, setSelectedJob] = useState<HCPJob | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const openJob = (j: HCPJob) => {
    setSelectedJob(j);
    setPanelOpen(true);
  };

  const { data: jobs = [], isLoading } = useScheduleJobs(filters);

  // Keep selected job in sync after refetch
  const liveJob = useMemo(
    () => (selectedJob ? jobs.find((j) => j.id === selectedJob.id) ?? selectedJob : null),
    [jobs, selectedJob],
  );

  const goToDay = (d: Date) => setFilters((f) => ({ ...f, date: d, view: "day" }));

  return (
    <DashboardLayout title="Schedule" fullHeight>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="sr-only">Schedule</h1>
          <div />
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing..." : "Sync now"}
          </Button>
        </div>

        <ScheduleFiltersBar filters={filters} onChange={setFilters} />
        <UnscheduledQueue onJobClick={openJob} />

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading jobs...
            </div>
          ) : filters.view === "day" ? (
            <ScheduleDayView
              date={filters.date}
              jobs={jobs}
              onJobClick={openJob}
              canEdit={canEdit}
            />
          ) : filters.view === "week" ? (
            <ScheduleWeekView
              date={filters.date}
              jobs={jobs}
              onJobClick={openJob}
              onDayClick={goToDay}
            />
          ) : (
            <ScheduleListView jobs={jobs} onJobClick={openJob} />
          )}
        </div>
      </div>

      <JobDetailsPanel
        job={liveJob}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        canEdit={canEdit}
      />
    </DashboardLayout>
  );
}
