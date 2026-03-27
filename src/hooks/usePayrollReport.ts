import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PayConfig {
  id: string;
  profile_id: string;
  organization_id: string;
  pay_model: 'salary' | 'commission';
  weekly_salary: number;
  commission_percent: number;
  effective_date: string;
}

export interface PayrollJob {
  id: string;
  hcp_job_id: string;
  customer_name: string | null;
  scheduled_date: string | null;
  total_amount: number | null;
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
  grossRevenue: number;
  totalTips: number;
  ccFeesOnRevenue: number;
  ccFeesOnTips: number;
  netPay: number;
  payModel: 'salary' | 'commission' | 'none';
  weeklySalary: number;
  commissionPercent: number;
}

function isCardPayment(method: string | null): boolean {
  if (!method) return false;
  const lower = method.toLowerCase();
  return lower.includes('card') || lower.includes('credit') || lower.includes('debit') || lower.includes('stripe');
}

function getBaseJobAmount(totalAmount: number | null, tipAmount: number | null): number {
  const total = Number(totalAmount) || 0;
  const tip = Number(tipAmount) || 0;
  if (tip <= 0) return total;
  return Math.max(total - tip, 0);
}

export function usePayrollReport(startDate: string, endDate: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['payroll-report', profile?.organization_id, startDate, endDate],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Fetch org settings for cc_fee_percent
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();

      const ccFeePercent = (org?.settings as any)?.cc_fee_percent ?? 3.49;

      // Fetch completed jobs in date range
      const { data: jobs, error: jobsError } = await supabase
        .from('hcp_jobs')
        .select('id, hcp_job_id, customer_name, scheduled_date, total_amount, tip_amount, cc_fee_amount, payment_method, status, services, technician_hcp_id, technician_name')
        .eq('organization_id', profile.organization_id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .in('status', ['complete unrated', 'complete rated', 'completed', 'paid']);

      if (jobsError) throw jobsError;

      // Fetch pay configs for all technicians
      const { data: payConfigs, error: payError } = await supabase
        .from('technician_pay_config' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .lte('effective_date', endDate)
        .order('effective_date', { ascending: false });

      if (payError) throw payError;

      // Link HCP employees to pay configs via profile
      const { data: hcpEmployees } = await supabase
        .from('hcp_employees')
        .select('hcp_employee_id, linked_user_id')
        .eq('organization_id', profile.organization_id);

      // Build a map: hcp_employee_id -> most recent pay config
      const hcpToProfile = new Map<string, string>();
      (hcpEmployees || []).forEach(e => {
        if (e.linked_user_id) hcpToProfile.set(e.hcp_employee_id, e.linked_user_id);
      });

      const profilePayConfig = new Map<string, PayConfig>();
      ((payConfigs as any[]) || []).forEach((pc: any) => {
        if (!profilePayConfig.has(pc.profile_id)) {
          profilePayConfig.set(pc.profile_id, pc);
        }
      });

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

      // Calculate payroll per technician
      const results: TechnicianPayroll[] = [];
      techMap.forEach((data, techId) => {
        const profileId = hcpToProfile.get(techId);
        const config = profileId ? profilePayConfig.get(profileId) : undefined;

        let grossRevenue = 0;
        let totalTips = 0;
        let ccFeesOnRevenue = 0;
        let ccFeesOnTips = 0;

        data.jobs.forEach(job => {
          const amount = getBaseJobAmount(job.total_amount, job.tip_amount);
          const tip = Number(job.tip_amount) || 0;
          const isCard = isCardPayment(job.payment_method);

          grossRevenue += amount;
          totalTips += tip;
          if (isCard) {
            ccFeesOnRevenue += amount * (ccFeePercent / 100);
            ccFeesOnTips += tip * (ccFeePercent / 100);
          }
        });

        let netPay = 0;
        const payModel = config?.pay_model || 'none';
        const weeklySalary = Number(config?.weekly_salary) || 0;
        const commissionPercent = Number(config?.commission_percent) || 0;

        if (payModel === 'salary') {
          // Weekly salary + tips - cc fees on tips
          // Note: salary is fixed per week, but here we show for the selected period
          netPay = weeklySalary + totalTips - ccFeesOnTips;
        } else if (payModel === 'commission') {
          // commission% * revenue - cc fees on revenue + tips - cc fees on tips
          netPay = (grossRevenue * commissionPercent / 100) - ccFeesOnRevenue + totalTips - ccFeesOnTips;
        } else {
          // No config - just show raw numbers
          netPay = grossRevenue + totalTips;
        }

        results.push({
          technician_hcp_id: techId,
          technician_name: data.name,
          jobs: data.jobs,
          jobCount: data.jobs.length,
          grossRevenue,
          totalTips,
          ccFeesOnRevenue,
          ccFeesOnTips,
          netPay,
          payModel,
          weeklySalary,
          commissionPercent,
        });
      });

      results.sort((a, b) => a.technician_name.localeCompare(b.technician_name));
      return results;
    },
    enabled: !!profile?.organization_id && !!startDate && !!endDate,
  });
}

export function usePayConfigs() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['pay-configs', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('technician_pay_config' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('effective_date', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useUpsertPayConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (config: { profile_id: string; pay_model: 'salary' | 'commission'; weekly_salary: number; commission_percent: number; effective_date: string }) => {
      if (!profile?.organization_id) throw new Error('No organization');
      const { error } = await supabase
        .from('technician_pay_config' as any)
        .upsert({
          ...config,
          organization_id: profile.organization_id,
        }, { onConflict: 'profile_id,effective_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-configs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] });
      toast.success('Pay configuration saved');
    },
    onError: (err) => toast.error(`Failed to save: ${(err as Error).message}`),
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

export function useUpdateCcFeePercent() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (percent: number) => {
      if (!profile?.organization_id) throw new Error('No organization');
      
      // Get current settings
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.organization_id)
        .single();

      const currentSettings = (org?.settings as Record<string, any>) || {};
      const { error } = await supabase
        .from('organizations')
        .update({ settings: { ...currentSettings, cc_fee_percent: percent } })
        .eq('id', profile.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-fee-percent'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] });
      toast.success('CC fee percentage updated');
    },
    onError: (err) => toast.error(`Failed: ${(err as Error).message}`),
  });
}
