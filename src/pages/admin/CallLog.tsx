import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/ringcentral";
import { CallDetailPanel } from "@/components/calls/CallDetailPanel";
import { QuickBookingPopover } from "@/components/calls/QuickBookingPopover";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Check,
  Phone,
  User,
  Loader2,
} from "lucide-react";

type CallDirection = "inbound" | "outbound";
type CallStatus = "completed" | "missed" | "voicemail" | "rejected" | "busy";
type MatchConfidence = "exact" | "partial" | "none";

interface CallLogEntry {
  id: string;
  rc_call_id: string;
  organization_id: string;
  location_id: string;
  direction: CallDirection;
  from_number: string;
  to_number: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: CallStatus;
  matched_customer_id: string | null;
  matched_customer_name: string | null;
  matched_customer_phone: string | null;
  match_confidence: MatchConfidence | null;
  linked_job_id: string | null;
  resulted_in_booking: boolean | null;
  booking_service_type: string | null;
  booking_job_id: string | null;
  recording_url: string | null;
  notes: string | null;
  synced_at: string | null;
}

type DirectionFilter = "all" | "inbound" | "outbound";
type StatusFilter = "all" | "completed" | "missed" | "voicemail";
type BookingFilter = "all" | "booked" | "not_booked";
type MatchFilter = "all" | "matched" | "unmatched";

function formatDuration(seconds: number | null, status: CallStatus): string {
  if (status === "missed") return "Missed";
  if (status === "voicemail") return "Voicemail";
  if (status === "busy") return "Busy";
  if (status === "rejected") return "Rejected";
  if (!seconds || seconds === 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getStatusBadgeVariant(status: CallStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "missed":
      return "destructive";
    case "voicemail":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusLabel(status: CallStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "missed":
      return "Missed";
    case "voicemail":
      return "Voicemail";
    case "rejected":
      return "Rejected";
    case "busy":
      return "Busy";
    default:
      return status;
  }
}

export default function CallLog() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";

  // Date range state
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));

  // Filter state
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");

  // Detail panel state
  const [selectedCall, setSelectedCall] = useState<CallLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch call log
  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ["call-log", profile?.organization_id, profile?.location_id, isAdmin, dateFrom, dateTo],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from("call_log")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .gte("started_at", dateFrom.toISOString())
        .lte("started_at", dateTo.toISOString())
        .order("started_at", { ascending: false });

      // Non-admins can only see their location's calls
      if (!isAdmin && profile.location_id) {
        query = query.eq("location_id", profile.location_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching call log:", error);
        throw error;
      }

      return (data || []) as CallLogEntry[];
    },
    enabled: !!profile?.organization_id,
  });

  // Sync range state
  const [syncDays, setSyncDays] = useState<number>(30);

  // Sync calls mutation
  const syncMutation = useMutation({
    mutationFn: async (daysBack: number = 30) => {
      if (!profile?.organization_id || !profile?.location_id) {
        throw new Error("Missing organization or location");
      }

      // Fetch organization credentials
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("rc_refresh_token")
        .eq("id", profile.organization_id)
        .single();

      if (orgError || !org) throw new Error("Failed to fetch organization");
      if (!org.rc_refresh_token) throw new Error("RingCentral not connected. Please connect in Integration Settings.");

      const { data, error } = await supabase.functions.invoke("sync-rc-calls", {
        body: {
          organization_id: profile.organization_id,
          location_id: profile.location_id,
          refresh_token: org.rc_refresh_token,
          days_back: daysBack,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast({
          title: "Sync complete",
          description: `Synced ${data.synced?.calls || 0} calls (${data.synced?.matched || 0} matched to customers)`,
        });
        refetch();
      } else {
        toast({
          title: "Sync failed",
          description: data?.error || "Unknown error",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle booking status mutation (for direct toggle without service type)
  const toggleBookingMutation = useMutation({
    mutationFn: async ({ callId, booked, serviceType }: { callId: string; booked: boolean; serviceType?: string }) => {
      const { error } = await supabase
        .from("call_log")
        .update({ 
          resulted_in_booking: booked,
          booking_service_type: booked ? serviceType || null : null,
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-log"] });
      queryClient.invalidateQueries({ queryKey: ["call-metrics"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter calls
  const filteredCalls = calls?.filter((call) => {
    if (directionFilter !== "all" && call.direction !== directionFilter) return false;
    if (statusFilter !== "all" && call.status !== statusFilter) return false;
    if (bookingFilter === "booked" && !call.resulted_in_booking) return false;
    if (bookingFilter === "not_booked" && call.resulted_in_booking) return false;
    if (matchFilter === "matched" && call.match_confidence === "none") return false;
    if (matchFilter === "unmatched" && call.match_confidence !== "none") return false;
    return true;
  });

  const handleRowClick = (call: CallLogEntry) => {
    setSelectedCall(call);
    setDetailOpen(true);
  };

  return (
    <DashboardLayout title="Call Log" description="View and manage call history">
      <div className="space-y-4">
        {/* Header with date picker and sync */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateFrom, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => date && setDateFrom(startOfDay(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">to</span>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateTo, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => date && setDateTo(endOfDay(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Sync Controls (admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Select value={syncDays.toString()} onValueChange={(v) => setSyncDays(parseInt(v))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sync range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => syncMutation.mutate(syncDays)}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Calls
              </Button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as DirectionFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
            </SelectContent>
          </Select>

          <Select value={bookingFilter} onValueChange={(v) => setBookingFilter(v as BookingFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Booking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="not_booked">Not Booked</SelectItem>
            </SelectContent>
          </Select>

          <Select value={matchFilter} onValueChange={(v) => setMatchFilter(v as MatchFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
            </SelectContent>
          </Select>

          {(directionFilter !== "all" || statusFilter !== "all" || bookingFilter !== "all" || matchFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDirectionFilter("all");
                setStatusFilter("all");
                setBookingFilter("all");
                setMatchFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Call Log Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[80px]">Duration</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[60px] text-center">Booked</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCalls?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Phone className="h-8 w-8 mb-2" />
                      <p>No calls found</p>
                      <p className="text-sm">Try adjusting the date range or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalls?.map((call) => {
                  const externalPhone = call.direction === "inbound" ? call.from_number : call.to_number;
                  const displayName = call.matched_customer_name || formatPhoneNumber(externalPhone);

                  return (
                    <TableRow
                      key={call.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(call)}
                    >
                      <TableCell className="font-mono text-sm">
                        {format(parseISO(call.started_at), "h:mm a")}
                      </TableCell>
                      <TableCell>
                        {call.direction === "inbound" ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-sky-600 dark:text-sky-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhoneNumber(externalPhone)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {call.match_confidence !== "none" && (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            call.matched_customer_name ? "font-medium" : "text-muted-foreground"
                          )}>
                            {displayName}
                          </span>
                          {call.match_confidence === "partial" && (
                            <Badge variant="outline" className="text-xs">Partial</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(call.duration_seconds, call.status)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(call.status)}>
                          {getStatusLabel(call.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <QuickBookingPopover
                          callId={call.id}
                          isBooked={!!call.resulted_in_booking}
                          currentServiceType={call.booking_service_type}
                          onToggle={(booked, serviceType) => {
                            toggleBookingMutation.mutate({ callId: call.id, booked, serviceType });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(call);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results count */}
        {!isLoading && filteredCalls && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredCalls.length} of {calls?.length || 0} calls
          </p>
        )}
      </div>

      {/* Call Detail Panel */}
      <CallDetailPanel
        call={selectedCall}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </DashboardLayout>
  );
}
