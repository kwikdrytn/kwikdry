import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronRight, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, normalizeStatus } from "@/hooks/useSchedule";
import type { HCPJob } from "@/hooks/useJobMap";

export function TodaysJobsCard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["dashboard-todays-jobs", profile?.organization_id, todayStr],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("hcp_jobs")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("scheduled_date", todayStr)
        .order("scheduled_time");
      if (error) throw error;
      return ((data ?? []) as HCPJob[]).filter(
        (j) => normalizeStatus(j.status) !== "cancelled",
      );
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 60000,
  });

  const formatTime = (t: string | null) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 || 12;
    return `${display}:${m} ${ampm}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Today's Jobs
          </CardTitle>
          <CardDescription>
            {jobs.length} scheduled for {format(new Date(), "EEE, MMM d")}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/schedule?date=${todayStr}&view=day`)}
          className="gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <ul className="divide-y">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-colors"
                onClick={() => navigate(`/schedule?date=${todayStr}&view=day`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-10 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: getStatusColor(job.status) }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {job.customer_name || "Unknown customer"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatTime(job.scheduled_time)}</span>
                      {job.technician_name && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3" />
                          <span className="truncate">{job.technician_name}</span>
                        </span>
                      )}
                      {job.city && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.city}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn("text-xs")}
                    style={{
                      borderColor: getStatusColor(job.status),
                      color: getStatusColor(job.status),
                    }}
                  >
                    {getStatusLabel(job.status)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No jobs scheduled for today
          </div>
        )}
      </CardContent>
    </Card>
  );
}
