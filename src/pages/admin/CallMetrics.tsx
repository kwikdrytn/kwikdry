import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  parseISO,
  getHours,
  eachDayOfInterval,
} from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone,
  PhoneMissed,
  CalendarCheck,
  Clock,
  CalendarIcon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

type DateRangePreset = "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "custom";

interface CallLogEntry {
  id: string;
  started_at: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail" | "rejected" | "busy";
  duration_seconds: number | null;
  resulted_in_booking: boolean | null;
  booking_service_type: string | null;
  location_id: string;
}

interface Location {
  id: string;
  name: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
];

function getDateRange(preset: DateRangePreset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_7_days":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "custom":
      return { 
        from: customFrom || startOfDay(subDays(now, 6)), 
        to: customTo || endOfDay(now) 
      };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export default function CallMetrics() {
  const { profile } = useAuth();
  const [datePreset, setDatePreset] = useState<DateRangePreset>("last_7_days");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo);

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ["locations", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as Location[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch call log data
  const { data: calls, isLoading } = useQuery({
    queryKey: ["call-metrics", profile?.organization_id, dateFrom, dateTo, selectedLocation],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from("call_log")
        .select("id, started_at, direction, status, duration_seconds, resulted_in_booking, booking_service_type, location_id")
        .eq("organization_id", profile.organization_id)
        .gte("started_at", dateFrom.toISOString())
        .lte("started_at", dateTo.toISOString());

      if (selectedLocation !== "all") {
        query = query.eq("location_id", selectedLocation);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as CallLogEntry[];
    },
    enabled: !!profile?.organization_id,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!calls || calls.length === 0) {
      return {
        totalCalls: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        missedCalls: 0,
        missedPercentage: 0,
        completedCalls: 0,
        bookedCalls: 0,
        bookingRate: 0,
        avgDuration: 0,
      };
    }

    const totalCalls = calls.length;
    const inboundCalls = calls.filter(c => c.direction === "inbound").length;
    const outboundCalls = calls.filter(c => c.direction === "outbound").length;
    const missedCalls = calls.filter(c => c.status === "missed" || c.status === "voicemail").length;
    const completedCalls = calls.filter(c => c.status === "completed").length;
    const bookedCalls = calls.filter(c => c.resulted_in_booking).length;
    
    const durations = calls
      .filter(c => c.duration_seconds && c.duration_seconds > 0)
      .map(c => c.duration_seconds!);
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return {
      totalCalls,
      inboundCalls,
      outboundCalls,
      missedCalls,
      missedPercentage: totalCalls > 0 ? Math.round((missedCalls / totalCalls) * 100) : 0,
      completedCalls,
      bookedCalls,
      bookingRate: completedCalls > 0 ? Math.round((bookedCalls / completedCalls) * 100) : 0,
      avgDuration,
    };
  }, [calls]);

  // Calls by day data
  const callsByDayData = useMemo(() => {
    if (!calls) return [];
    
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCalls = calls.filter(c => format(parseISO(c.started_at), "yyyy-MM-dd") === dayStr);
      const missed = dayCalls.filter(c => c.status === "missed" || c.status === "voicemail").length;
      const booked = dayCalls.filter(c => c.resulted_in_booking).length;
      
      return {
        date: format(day, "MMM d"),
        total: dayCalls.length,
        missed,
        booked,
      };
    });
  }, [calls, dateFrom, dateTo]);

  // Booking rate trend data
  const bookingRateTrendData = useMemo(() => {
    if (!calls) return [];
    
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCalls = calls.filter(c => format(parseISO(c.started_at), "yyyy-MM-dd") === dayStr);
      const completed = dayCalls.filter(c => c.status === "completed").length;
      const booked = dayCalls.filter(c => c.resulted_in_booking).length;
      const rate = completed > 0 ? Math.round((booked / completed) * 100) : 0;
      
      return {
        date: format(day, "MMM d"),
        rate,
      };
    });
  }, [calls, dateFrom, dateTo]);

  // Bookings by service type data
  const bookingsByServiceData = useMemo(() => {
    if (!calls) return [];
    
    const serviceMap = new Map<string, number>();
    
    calls.filter(c => c.resulted_in_booking && c.booking_service_type).forEach(call => {
      const service = call.booking_service_type || "Other";
      serviceMap.set(service, (serviceMap.get(service) || 0) + 1);
    });
    
    return Array.from(serviceMap.entries()).map(([name, value]) => ({ name, value }));
  }, [calls]);

  // Calls by hour data
  const callsByHourData = useMemo(() => {
    if (!calls) return [];
    
    const hourMap = new Map<number, number>();
    
    // Initialize hours 6am to 9pm
    for (let h = 6; h <= 21; h++) {
      hourMap.set(h, 0);
    }
    
    calls.forEach(call => {
      const hour = getHours(parseISO(call.started_at));
      if (hour >= 6 && hour <= 21) {
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      }
    });
    
    return Array.from(hourMap.entries()).map(([hour, count]) => ({
      hour: format(new Date().setHours(hour, 0, 0, 0), "ha"),
      calls: count,
    }));
  }, [calls]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <DashboardLayout title="Call Metrics">
      <div className="space-y-6">
        {/* Header with filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date preset selector */}
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date pickers */}
            {datePreset === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, "MMM d") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={(date) => date && setCustomFrom(startOfDay(date))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, "MMM d") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={(date) => date && setCustomTo(endOfDay(date))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>

          {/* Location filter */}
          {locations && locations.length > 1 && (
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Calls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalCalls}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.inboundCalls} inbound · {metrics.outboundCalls} outbound
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Missed Calls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Missed Calls</CardTitle>
              <PhoneMissed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {metrics.missedCalls}
                    <span className={`text-sm font-normal ${metrics.missedPercentage > 20 ? "text-destructive" : "text-muted-foreground"}`}>
                      ({metrics.missedPercentage}%)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Includes voicemails
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Booking Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Booking Rate</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {metrics.bookingRate}%
                    {metrics.bookingRate >= 50 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.bookedCalls} of {metrics.completedCalls} completed
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Average Duration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatDuration(metrics.avgDuration)}</div>
                  <p className="text-xs text-muted-foreground">
                    Per completed call
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Calls by Day */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Calls by Day</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : callsByDayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={callsByDayData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      name="Total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="missed" 
                      name="Missed" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--destructive))" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="booked" 
                      name="Booked" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : bookingRateTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={bookingRateTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, "Booking Rate"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="rate" 
                      name="Rate" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bookings by Service Type */}
          <Card>
            <CardHeader>
              <CardTitle>Bookings by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : bookingsByServiceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={bookingsByServiceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {bookingsByServiceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  No booking data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calls by Hour */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Calls by Hour of Day</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : callsByHourData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={callsByHourData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="hour" 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar 
                      dataKey="calls" 
                      name="Calls" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Date range info */}
        <p className="text-sm text-muted-foreground text-center">
          Showing data from {format(dateFrom, "MMM d, yyyy")} to {format(dateTo, "MMM d, yyyy")}
        </p>
      </div>
    </DashboardLayout>
  );
}
