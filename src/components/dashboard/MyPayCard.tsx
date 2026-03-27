import { useMemo } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, CreditCard, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function isCardPayment(method: string | null): boolean {
  if (!method) return false;
  const lower = method.toLowerCase();
  return lower.includes('card') || lower.includes('credit') || lower.includes('debit') || lower.includes('stripe');
}

export function MyPayCard() {
  const { profile } = useAuth();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');

  // Get the technician's HCP employee ID
  const { data: hcpEmployee } = useQuery({
    queryKey: ['my-hcp-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('hcp_employees')
        .select('hcp_employee_id')
        .eq('linked_user_id', profile.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  // Get org pay settings
  const { data: orgSettings } = useQuery({
    queryKey: ['my-pay-org-settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
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
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Get this week's jobs for this technician
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['my-pay-jobs', hcpEmployee?.hcp_employee_id, startStr, endStr],
    queryFn: async () => {
      if (!hcpEmployee?.hcp_employee_id || !profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('hcp_jobs')
        .select('id, total_amount, tip_amount, cc_fee_amount, payment_method, scheduled_date, customer_name, services')
        .eq('organization_id', profile.organization_id)
        .eq('technician_hcp_id', hcpEmployee.hcp_employee_id)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .in('status', ['complete unrated', 'complete rated', 'completed', 'paid']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!hcpEmployee?.hcp_employee_id && !!profile?.organization_id,
  });

  const payData = useMemo(() => {
    if (!jobs || !orgSettings) return null;
    
    let revenue = 0;
    let tips = 0;
    let ccFeesOnTips = 0;

    jobs.forEach(job => {
      const total = Number(job.total_amount) || 0;
      const tip = Number(job.tip_amount) || 0;
      const jobAmount = tip > 0 ? Math.max(total - tip, 0) : total;
      revenue += jobAmount;
      tips += tip;
      if (isCardPayment(job.payment_method) && tip > 0) {
        ccFeesOnTips += tip * (orgSettings.cc_fee_percent / 100);
      }
    });

    const commPay = revenue * orgSettings.commission_percent / 100;
    const basePay = Math.max(commPay, orgSettings.weekly_minimum);
    const isGuarantee = commPay < orgSettings.weekly_minimum;
    const netPay = basePay + tips - ccFeesOnTips;

    return { revenue, tips, ccFeesOnTips, basePay, netPay, isGuarantee, jobCount: jobs.length };
  }, [jobs, orgSettings]);

  if (!hcpEmployee) {
    return null; // Not linked to HCP — don't show
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          My Pay This Week
        </CardTitle>
        <CardDescription>
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !payData ? (
          <p className="text-sm text-muted-foreground">No pay data available</p>
        ) : (
          <div className="space-y-4">
            {/* Net Pay Hero */}
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Estimated Net Pay</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(payData.netPay)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {payData.jobCount} job{payData.jobCount !== 1 ? 's' : ''} completed
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Base Pay ({payData.isGuarantee ? 'Guarantee' : `${orgSettings?.commission_percent}%`})
                </span>
                <span className="font-medium">{formatCurrency(payData.basePay)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" />
                  Tips
                </span>
                <span className="font-medium text-primary">+{formatCurrency(payData.tips)}</span>
              </div>
              {payData.ccFeesOnTips > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    CC Fees on Tips
                  </span>
                  <span className="font-medium text-destructive">-{formatCurrency(payData.ccFeesOnTips)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
