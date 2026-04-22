import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, startOfDay, startOfWeek } from "date-fns";
import { toast } from "sonner";
import type { HCPJob } from "@/hooks/useJobMap";

export type ScheduleViewMode = "day" | "week" | "list";

export interface ScheduleFilters {
  date: Date;
  view: ScheduleViewMode;
  technicians: string[]; // 'all' | 'unassigned' | hcp_employee_id[]
  statuses: string[]; // 'all' | status values
  serviceTypes: string[]; // 'all' | service names
  search: string;
}

export const DEFAULT_SCHEDULE_FILTERS: ScheduleFilters = {
  date: new Date(),
  view: "day",
  technicians: ["all"],
  statuses: ["all"],
  serviceTypes: ["all"],
  search: "",
};

export const SCHEDULE_STATUSES = [
  { value: "scheduled", label: "Scheduled", color: "hsl(217 91% 60%)" },
  { value: "in_progress", label: "In Progress", color: "hsl(38 92% 50%)" },
  { value: "completed", label: "Completed", color: "hsl(142 71% 45%)" },
  { value: "cancelled", label: "Cancelled", color: "hsl(0 84% 60%)" },
  { value: "needs_scheduling", label: "Needs Scheduling", color: "hsl(280 70% 60%)" },
];

export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "scheduled";
  return status.toLowerCase().replace(/\s+/g, "_");
}

export function getStatusColor(status: string | null | undefined): string {
  const norm = normalizeStatus(status);
  return SCHEDULE_STATUSES.find((s) => s.value === norm)?.color ?? "hsl(217 91% 60%)";
}

export function getStatusLabel(status: string | null | undefined): string {
  const norm = normalizeStatus(status);
  return SCHEDULE_STATUSES.find((s) => s.value === norm)?.label ?? "Scheduled";
}

export function useScheduleJobs(filters: ScheduleFilters) {
  const { profile } = useAuth();

  const start = startOfDay(filters.date);
  let end = start;
  if (filters.view === "week") {
    const weekStart = startOfWeek(start, { weekStartsOn: 1 });
    end = addDays(weekStart, 6);
  } else if (filters.view === "list") {
    // For list view, show a 7-day window centered on date
    end = addDays(start, 6);
  }
  const queryStart = filters.view === "week" ? startOfWeek(start, { weekStartsOn: 1 }) : start;

  return useQuery({
    queryKey: [
      "schedule-jobs",
      profile?.organization_id,
      format(queryStart, "yyyy-MM-dd"),
      format(end, "yyyy-MM-dd"),
      filters.view,
      filters.technicians.join(","),
      filters.statuses.join(","),
      filters.serviceTypes.join(","),
      filters.search,
    ],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("hcp_jobs")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .gte("scheduled_date", format(queryStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(end, "yyyy-MM-dd"))
        .order("scheduled_date")
        .order("scheduled_time");

      if (error) throw error;

      let jobs = (data ?? []) as HCPJob[];

      if (!filters.technicians.includes("all")) {
        jobs = jobs.filter((job) => {
          if (filters.technicians.includes("unassigned") && !job.technician_hcp_id) return true;
          return !!job.technician_hcp_id && filters.technicians.includes(job.technician_hcp_id);
        });
      }

      if (!filters.statuses.includes("all")) {
        jobs = jobs.filter((job) => filters.statuses.includes(normalizeStatus(job.status)));
      }

      if (!filters.serviceTypes.includes("all")) {
        jobs = jobs.filter((job) => {
          const services = (job.services as { name?: string }[] | null) ?? [];
          return services.some((s) => s.name && filters.serviceTypes.includes(s.name));
        });
      }

      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        jobs = jobs.filter(
          (j) =>
            j.customer_name?.toLowerCase().includes(q) ||
            j.address?.toLowerCase().includes(q) ||
            j.hcp_job_id?.toLowerCase().includes(q),
        );
      }

      return jobs;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useUnscheduledJobs() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["schedule-unscheduled", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("hcp_jobs")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .is("scheduled_date", null)
        .order("synced_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as HCPJob[];
    },
    enabled: !!profile?.organization_id,
  });
}

export interface UpdateJobInput {
  hcpJobId: string;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEnd?: string;
  technicianHcpId?: string;
  status?: string;
  notes?: string;
  services?: string[];
}

export function useUpdateScheduleJob() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateJobInput) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { data, error } = await supabase.functions.invoke("update-hcp-job", {
        body: {
          organizationId: profile.organization_id,
          ...input,
        },
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Update failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["job-map-jobs-range"] });
      toast.success("Job updated");
    },
    onError: (e: Error) => {
      toast.error(`Failed to update job: ${e.message}`);
    },
  });
}

export function useSyncHcp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-hcp-data");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-unscheduled"] });
      queryClient.invalidateQueries({ queryKey: ["job-map-jobs-range"] });
      toast.success("HouseCall Pro data synced");
    },
    onError: (e: Error) => {
      toast.error(`Sync failed: ${e.message}`);
    },
  });
}

// URL state helpers
export function filtersToParams(filters: ScheduleFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set("date", format(filters.date, "yyyy-MM-dd"));
  p.set("view", filters.view);
  if (!filters.technicians.includes("all")) p.set("techs", filters.technicians.join(","));
  if (!filters.statuses.includes("all")) p.set("statuses", filters.statuses.join(","));
  if (!filters.serviceTypes.includes("all")) p.set("services", filters.serviceTypes.join(","));
  if (filters.search.trim()) p.set("q", filters.search.trim());
  return p;
}

export function paramsToFilters(p: URLSearchParams): Partial<ScheduleFilters> {
  const out: Partial<ScheduleFilters> = {};
  const d = p.get("date");
  if (d) {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) out.date = parsed;
  }
  const v = p.get("view");
  if (v === "day" || v === "week" || v === "list") out.view = v;
  const t = p.get("techs");
  if (t) out.technicians = t.split(",");
  const s = p.get("statuses");
  if (s) out.statuses = s.split(",");
  const sv = p.get("services");
  if (sv) out.serviceTypes = sv.split(",");
  const q = p.get("q");
  if (q) out.search = q;
  return out;
}

export function countActive(f: ScheduleFilters): number {
  let n = 0;
  if (!f.technicians.includes("all")) n++;
  if (!f.statuses.includes("all")) n++;
  if (!f.serviceTypes.includes("all")) n++;
  if (f.search.trim()) n++;
  return n;
}
