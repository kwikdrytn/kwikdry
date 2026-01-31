import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Phone, 
  PhoneMissed, 
  TrendingUp, 
  Map, 
  List,
  ChevronRight,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CallStaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "User";
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Fetch today's call stats
  const { data: callStats, isLoading: statsLoading } = useQuery({
    queryKey: ['call-staff-stats', profile?.organization_id, todayStr],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      // Get all calls for today
      const { data, error } = await supabase
        .from('call_log')
        .select('id, status, resulted_in_booking, direction')
        .eq('organization_id', profile.organization_id)
        .gte('started_at', `${todayStr}T00:00:00`)
        .lt('started_at', `${todayStr}T23:59:59`);

      if (error) throw error;

      const calls = data || [];
      const totalCalls = calls.length;
      const missedCalls = calls.filter(c => c.status === 'missed').length;
      const bookings = calls.filter(c => c.resulted_in_booking).length;
      const completedCalls = calls.filter(c => c.status === 'completed').length;
      const bookingRate = completedCalls > 0 ? Math.round((bookings / completedCalls) * 100) : 0;

      return { totalCalls, missedCalls, bookingRate };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch recent calls
  const { data: recentCalls, isLoading: callsLoading } = useQuery({
    queryKey: ['call-staff-recent-calls', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('call_log')
        .select(`
          id,
          started_at,
          from_number,
          to_number,
          direction,
          duration_seconds,
          status,
          matched_customer_name
        `)
        .eq('organization_id', profile.organization_id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed': return 'default';
      case 'missed': return 'destructive';
      case 'voicemail': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Today's Stats Cards */}
      <div className="grid gap-4 grid-cols-3">
        {/* Total Calls */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              Total Calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{callStats?.totalCalls || 0}</p>
            )}
          </CardContent>
        </Card>

        {/* Missed Calls */}
        <Card className={cn(
          callStats?.missedCalls && callStats.missedCalls > 0 && "border-destructive/50"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className={cn(
              "flex items-center gap-1.5",
              callStats?.missedCalls && callStats.missedCalls > 0 && "text-destructive"
            )}>
              <PhoneMissed className="h-4 w-4" />
              Missed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className={cn(
                "text-3xl font-bold",
                callStats?.missedCalls && callStats.missedCalls > 0 && "text-destructive"
              )}>
                {callStats?.missedCalls || 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Booking Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Booking Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold text-primary">
                {callStats?.bookingRate || 0}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-2">
        <Button 
          size="lg" 
          className="h-16 text-lg"
          onClick={() => navigate('/job-map')}
        >
          <Map className="mr-2 h-5 w-5" />
          View Job Map
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          className="h-16 text-lg"
          onClick={() => navigate('/calls')}
        >
          <List className="mr-2 h-5 w-5" />
          View Call Log
        </Button>
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Recent Calls
          </CardTitle>
          <CardDescription>Last 10 calls across all locations</CardDescription>
        </CardHeader>
        <CardContent>
          {callsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentCalls && recentCalls.length > 0 ? (
            <ul className="divide-y">
              {recentCalls.map((call: any) => (
                <li 
                  key={call.id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => navigate(`/calls?callId=${call.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      call.direction === 'inbound' ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Phone className={cn(
                        "h-4 w-4",
                        call.direction === 'inbound' ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {call.matched_customer_name || formatPhoneNumber(
                          call.direction === 'inbound' ? call.from_number : call.to_number
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(call.started_at), "h:mm a")}
                        {call.duration_seconds && ` · ${formatDuration(call.duration_seconds)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(call.status)}>
                      {call.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No calls today
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
