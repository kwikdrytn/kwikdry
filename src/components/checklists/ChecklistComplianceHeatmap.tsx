import { useMemo } from "react";
import { format, subDays, startOfYear, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ComplianceData {
  technician_id: string;
  first_name: string | null;
  last_name: string | null;
  weekData: Record<string, number>; // "yyyy-MM-dd" => submission count for that week
}

export function ChecklistComplianceHeatmap() {
  const { profile } = useAuth();
  const today = new Date();
  
  // Last 8 weeks
  const weeks = useMemo(() => {
    const start = subDays(today, 55); // ~8 weeks back
    return eachWeekOfInterval({ start, end: today }, { weekStartsOn: 1 }).slice(-8);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['checklist-compliance-heatmap', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get technicians
      const { data: techs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('first_name');

      if (!techs?.length) return [];

      // Get submissions for last 8 weeks
      const earliestWeek = format(weeks[0], 'yyyy-MM-dd');
      const { data: submissions } = await supabase
        .from('checklist_submissions')
        .select('technician_id, period_date')
        .in('technician_id', techs.map(t => t.id))
        .gte('period_date', earliestWeek);

      // Build per-tech per-week counts
      const result: ComplianceData[] = techs.map(tech => {
        const weekData: Record<string, number> = {};
        weeks.forEach(w => {
          const ws = format(w, 'yyyy-MM-dd');
          const we = format(endOfWeek(w, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          const count = submissions?.filter(s => 
            s.technician_id === tech.id && s.period_date >= ws && s.period_date <= we
          ).length || 0;
          weekData[ws] = count;
        });
        return {
          technician_id: tech.id,
          first_name: tech.first_name,
          last_name: tech.last_name,
          weekData,
        };
      });

      return result;
    },
    enabled: !!profile?.organization_id,
  });

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    if (count <= 2) return 'bg-warning/40';
    if (count <= 4) return 'bg-primary/40';
    return 'bg-primary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Checklist Compliance</CardTitle>
        <CardDescription>Weekly submission frequency per technician (last 8 weeks)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No technicians found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 min-w-[120px]">Technician</th>
                  {weeks.map(w => (
                    <th key={w.toISOString()} className="text-center text-xs font-medium text-muted-foreground py-2 px-1 min-w-[40px]">
                      {format(w, 'M/d')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(tech => (
                  <tr key={tech.technician_id}>
                    <td className="py-2 pr-4 text-sm font-medium">
                      {[tech.first_name, tech.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </td>
                    {weeks.map(w => {
                      const ws = format(w, 'yyyy-MM-dd');
                      const count = tech.weekData[ws] || 0;
                      return (
                        <td key={ws} className="py-2 px-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "h-7 w-7 mx-auto rounded-sm flex items-center justify-center text-xs font-medium",
                                getColor(count),
                                count > 0 && count <= 2 && "text-warning-foreground",
                                count > 2 && "text-primary-foreground",
                                count === 0 && "text-muted-foreground"
                              )}>
                                {count}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {count} submission{count !== 1 ? 's' : ''} week of {format(w, 'MMM d')}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
