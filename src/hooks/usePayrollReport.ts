import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, format } from "date-fns";

export interface PayrollJob {
  id: string;
  scheduled_date: string | null;
  customer_name: string | null;
  services: any;
  total_amount: number | null;
  tip_amount: number | null;
  cc_fee_amount: number | null;
  payment_method: string | null;
  status: string | null;
  technician_name: string | null;
  technician_hcp_id: string | null;
}

export interface TechnicianPayrollSummary {
  technicianName: string;
  technicianHcpId: string | null;
  jobCount: number;
  totalRevenue: number;
  totalTips: number;
  totalCcFees: number;
  netRevenue: number;
  jobs: PayrollJob[];
}

export interface PayrollReportData {
  technicians: TechnicianPayrollSummary[];
  grandTotals: {
    jobCount: number;
    totalRevenue: number;
    totalTips: number;
    totalCcFees: number;
    netRevenue: number;
  };
}

interface UsePayrollReportOptions {
  startDate: Date;
  endDate: Date;
}

export function usePayrollReport({ startDate, endDate }: UsePayrollReportOptions) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: [
      "payroll-report",
      profile?.organization_id,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async (): Promise<PayrollReportData> => {
      const { data, error } = await supabase
        .from("hcp_jobs")
        .select(
          "id, scheduled_date, customer_name, services, total_amount, tip_amount, cc_fee_amount, payment_method, status, technician_name, technician_hcp_id"
        )
        .eq("organization_id", profile!.organization_id)
        .gte("scheduled_date", format(startDate, "yyyy-MM-dd"))
        .lte("scheduled_date", format(endDate, "yyyy-MM-dd"))
        .in("status", ["completed", "paid", "pro forma"])
        .order("scheduled_date", { ascending: true });

      if (error) throw error;

      const jobs = (data || []) as PayrollJob[];

      // Group by technician
      const techMap = new Map<string, TechnicianPayrollSummary>();

      for (const job of jobs) {
        const key = job.technician_hcp_id || job.technician_name || "Unassigned";
        const name = job.technician_name || "Unassigned";

        if (!techMap.has(key)) {
          techMap.set(key, {
            technicianName: name,
            technicianHcpId: job.technician_hcp_id,
            jobCount: 0,
            totalRevenue: 0,
            totalTips: 0,
            totalCcFees: 0,
            netRevenue: 0,
            jobs: [],
          });
        }

        const summary = techMap.get(key)!;
        const amount = job.total_amount || 0;
        const tip = job.tip_amount || 0;
        const fee = job.cc_fee_amount || 0;

        summary.jobCount++;
        summary.totalRevenue += amount;
        summary.totalTips += tip;
        summary.totalCcFees += fee;
        summary.netRevenue += amount - fee;
        summary.jobs.push(job);
      }

      const technicians = Array.from(techMap.values()).sort(
        (a, b) => b.totalRevenue - a.totalRevenue
      );

      const grandTotals = technicians.reduce(
        (acc, t) => ({
          jobCount: acc.jobCount + t.jobCount,
          totalRevenue: acc.totalRevenue + t.totalRevenue,
          totalTips: acc.totalTips + t.totalTips,
          totalCcFees: acc.totalCcFees + t.totalCcFees,
          netRevenue: acc.netRevenue + t.netRevenue,
        }),
        { jobCount: 0, totalRevenue: 0, totalTips: 0, totalCcFees: 0, netRevenue: 0 }
      );

      return { technicians, grandTotals };
    },
    enabled: !!profile?.organization_id,
  });
}

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return { start, end };
}
