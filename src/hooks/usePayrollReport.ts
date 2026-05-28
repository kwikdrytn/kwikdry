import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, addWeeks, isBefore, format, parseISO } from "date-fns";
import { toast } from "sonner";

export interface PayrollJob {
  id: string;
  hcp_job_id: string;
  customer_name: string | null;
  scheduled_date: string | null;
  total_amount: number | null;
  subtotal_amount: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  tip_amount: number | null;
  cc_fee_amount: number | null;
  payment_method: string | null;
  status: string | null;
  services: any;
}

export interface TechnicianPayroll {
  technician_hcp_id: string;
  technician_name: string;
  jobs: PayrollJob[];
  jobCount: number;
  /** Sum of (subtotal - discount) — what customers actually paid, used for display */
  grossRevenue: number;
  /** Sum of subtotal_amount only (pre-discount) — used when commission_basis = "pre_discount" */
  grossSubtotal: number;
  totalTips: number;
  ccFeesOnRevenue: number;
  ccFeesOnTips: number;
  netPay: number;
  basePay: number;
  guaranteeWeeks: number;
  commissionWeeks: number;
  weeklyMinimum: number;
  commissionPercent: number;
  /** Which amount the commission was calculated on: "pre_discount" | "post_discount" */
  commissionBasis: "pre_discount" | "post_discount";
}

function isCardPayment(method: string | null): boolean {
  if (!method) return false;
  const lower = method.toLowerCase();
  return lower.includes('card') || lower.includes('credit') || lower.includes('debit') || lower.includes('stripe');
}

/**
 * Post-discount amount: what the customer actually paid (subtotal - discount).
 * Falls back to total_amount - tip_amount for legacy jobs without subtotal data.
 */
function getPostDiscountAmount(job: PayrollJob): number {
  const subtotal = Number(job.subtotal_amount);
  const discount = Number(job.discount_amount) || 0;
  if (!isNaN(subtotal) && subtotal > 0) {
    return Math.max(subtotal - discount, 0);
  }
  const total = Number(job.total_amount) || 0;
  const tip = Number(job.tip_amount) || 0;
  return Math.max(total - tip, 0);
}

/**
 * Pre-discount amount: subtotal only, ignoring any discounts.
 * Falls back to post-discount amount for legacy jobs without subtotal data.
 */
function getPreDiscountAmount(job: PayrollJob): number {
  const subtotal = Number(job.subtotal_amount);
  if (!isNaN(subtotal) && subtotal > 0) {
    return subtotal;
  }
  // No subtotal stored — fall back to post-discount (best we can do)
  return getPostDiscountAmount(job);
}

/** Get all Mon-Sun week boundaries that overlap [rangeStart, rangeEnd] */
function getWeekBoundaries(rangeStart: string, rangeEnd: string): { weekStart: Date; weekEnd: Date }[] {
  const start = parseISO(rangeStart);
  const end = parseISO(rangeEnd);
  const weeks: { weekStart: Date; weekEnd: Date }[] = [];

  let current = startOfWeek(start, { weekStartsOn: 1 });
  while (isBefore(current, end) || format(current, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    const ws = current;
    const we = endOfWeek(current, { weekStartsOn: 1 });
    weeks.push({ weekStart: ws, weekEnd: we });
    current = addWeeks(current, 1);
  }
  return weeks;
}

export function usePayrollReport(startDate: string, endDate: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['payroll-report', profile?.organization_id, startDate, endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Fetch org settings
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();

      const settings = (org?.settings as any) || {};
      const ccFeePercent = settings.cc_fee_percent ?? 3.49;
      const weeklyMinimum = settings.weekly_minimum ?? 1000;
      const commissionPercent = settings.commission_percent ?? 40;
      const commissionBasis: "pre_discount" | "post_discount" =
        settings.commission_basis === "pre_discount" ? "pre_discount" : "post_discount";

      // Fetch completed jobs in date range
      const { data: jobs, error: jobsError } = await supabase
        .from('hcp_jobs')
        .select('id, hcp_job_id, customer_name, scheduled_date, total_amount, subtotal_amount, discount_amount, tax_amount, tip_amount, cc_fee_amount, payment_method, status, services, technician_hcp_id, technician_name')
        .eq('organization_id', profile.organization_id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .in('status', ['complete unrated', 'complete rated', 'completed', 'paid']);

      if (jobsError) throw jobsError;

      // Group jobs by technician
      const techMap = new Map<string, { name: string; jobs: PayrollJob[] }>();
      (jobs || []).forEach(job => {
        const techId = job.technician_hcp_id || 'unassigned';
        const techName = job.technician_name || 'Unassigned';
        if (!techMap.has(techId)) {
          techMap.set(techId, { name: techName, jobs: [] });
        }
        techMap.get(techId)!.jobs.push(job as PayrollJob);
      });

      const weeks = getWeekBoundaries(startDate, endDate);

      const results: TechnicianPayroll[] = [];
      techMap.forEach((data, techId) => {
        let grossRevenue = 0;   // post-discount (display)
        let grossSubtotal = 0;  // pre-discount (commission on subtotal rule)
        let totalTips = 0;
        let ccFeesOnRevenue = 0;
        let ccFeesOnTips = 0;

        data.jobs.forEach(job => {
          const postDiscount = getPostDiscountAmount(job);
          const preDiscount  = getPreDiscountAmount(job);
          const tip = Number(job.tip_amount) || 0;
          const isCard = isCardPayment(job.payment_method);

          grossRevenue  += postDiscount;
          grossSubtotal += preDiscount;
          totalTips     += tip;
          if (isCard) {
            ccFeesOnRevenue += postDiscount * (ccFeePercent / 100);
            ccFeesOnTips    += tip * (ccFeePercent / 100);
          }
        });

        // Per-week hybrid calculation
        // commissionBasis controls whether weekly revenue uses pre- or post-discount amounts
        let basePay = 0;
        let guaranteeWeeks = 0;
        let commissionWeeks = 0;

        weeks.forEach(({ weekStart, weekEnd }) => {
          const wsStr = format(weekStart, 'yyyy-MM-dd');
          const weStr = format(weekEnd, 'yyyy-MM-dd');

          let weekRevenue = 0;
          data.jobs.forEach(job => {
            if (job.scheduled_date && job.scheduled_date >= wsStr && job.scheduled_date <= weStr) {
              weekRevenue += commissionBasis === "pre_discount"
                ? getPreDiscountAmount(job)
                : getPostDiscountAmount(job);
            }
          });

          if (weekRevenue > 0 || weeks.length === 1) {
            const commPay = weekRevenue * commissionPercent / 100;
            if (commPay >= weeklyMinimum) {
              basePay += commPay;
              commissionWeeks++;
            } else {
              basePay += weeklyMinimum;
              guaranteeWeeks++;
            }
          }
        });

        const netPay = basePay + totalTips - ccFeesOnTips;

        results.push({
          technician_hcp_id: techId,
          technician_name: data.name,
          jobs: data.jobs,
          jobCount: data.jobs.length,
          grossRevenue,
          grossSubtotal,
          totalTips,
          ccFeesOnRevenue,
          ccFeesOnTips,
          netPay,
          basePay,
          guaranteeWeeks,
          commissionWeeks,
          weeklyMinimum,
          commissionPercent,
          commissionBasis,
        });
      });

      results.sort((a, b) => a.technician_name.localeCompare(b.technician_name));
      return results;
    },
    enabled: !!profile?.organization_id && !!startDate && !!endDate,
  });
}

export function useCcFeePercent() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['cc-fee-percent', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 3.49;
      const { data } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();
      return (data?.settings as any)?.cc_fee_percent ?? 3.49;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useOrgPaySettings() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['org-pay-settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return {
        cc_fee_percent: 3.49,
        weekly_minimum: 1000,
        commission_percent: 40,
        commission_basis: "post_discount" as "pre_discount" | "post_discount",
      };
      const { data } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();
      const s = (data?.settings as any) || {};
      return {
        cc_fee_percent: s.cc_fee_percent ?? 3.49,
        weekly_minimum: s.weekly_minimum ?? 1000,
        commission_percent: s.commission_percent ?? 40,
        commission_basis: (s.commission_basis === "pre_discount" ? "pre_discount" : "post_discount") as "pre_discount" | "post_discount",
      };
    },
    enabled: !!profile?.organization_id,
  });
}

export function useUpdateOrgPaySettings() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (updates: {
      cc_fee_percent?: number;
      weekly_minimum?: number;
      commission_percent?: number;
      commission_basis?: "pre_discount" | "post_discount";
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();

      const currentSettings = (org?.settings as Record<string, any>) || {};
      const { error } = await supabase
        .from('organizations')
        .update({ settings: { ...currentSettings, ...updates } })
        .eq('id', profile.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-pay-settings'] });
      queryClient.invalidateQueries({ queryKey: ['cc-fee-percent'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] });
      toast.success('Pay settings updated');
    },
    onError: (err) => toast.error(`Failed: ${(err as Error).message}`),
  });
}
