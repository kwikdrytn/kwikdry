import { useMemo } from "react";
import { format, startOfYear } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function PayrollYTDSummary() {
  const { profile } = useAuth();
  const today = new Date();
  const yearStart = format(startOfYear(today), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-ytd', profile?.organization_id, yearStart],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data: jobs, error } = await supabase
        .from('hcp_jobs')
        .select('technician_name, total_amount, tip_amount, cc_fee_amount, payment_method')
        .eq('organization_id', profile.organization_id)
        .gte('scheduled_date', yearStart)
        .lte('scheduled_date', todayStr)
        .in('status', ['complete unrated', 'complete rated', 'completed', 'paid']);

      if (error) throw error;

      let totalRevenue = 0;
      let totalTips = 0;
      let totalJobs = 0;
      const techTotals: Record<string, { revenue: number; tips: number; jobs: number }> = {};

      (jobs || []).forEach(job => {
        const total = Number(job.total_amount) || 0;
        const tip = Number(job.tip_amount) || 0;
        const amount = tip > 0 ? Math.max(total - tip, 0) : total;
        
        totalRevenue += amount;
        totalTips += tip;
        totalJobs++;

        const name = job.technician_name || 'Unassigned';
        if (!techTotals[name]) techTotals[name] = { revenue: 0, tips: 0, jobs: 0 };
        techTotals[name].revenue += amount;
        techTotals[name].tips += tip;
        techTotals[name].jobs++;
      });

      const topTechs = Object.entries(techTotals)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5);

      return { totalRevenue, totalTips, totalJobs, topTechs };
    },
    enabled: !!profile?.organization_id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Year-to-Date Summary
        </CardTitle>
        <CardDescription>{format(startOfYear(today), 'MMM d')} – {format(today, 'MMM d, yyyy')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.totalTips)}</p>
                <p className="text-xs text-muted-foreground">Tips</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalJobs}</p>
                <p className="text-xs text-muted-foreground">Jobs</p>
              </div>
            </div>
            {data.topTechs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Top Earners</p>
                {data.topTechs.map(([name, totals]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="font-medium">{formatCurrency(totals.revenue)} ({totals.jobs} jobs)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
