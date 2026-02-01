import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPhoneNumber } from "@/lib/ringcentral";
import { CallRecordingPlayer } from "@/components/calls/CallRecordingPlayer";
import { QuickBookingPopover } from "@/components/calls/QuickBookingPopover";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Eye,
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

interface CallCardListProps {
  calls: CallLogEntry[];
  onViewCall: (call: CallLogEntry) => void;
  onToggleBooking: (callId: string, booked: boolean, serviceType?: string) => void;
}

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

export function CallCardList({ calls, onViewCall, onToggleBooking }: CallCardListProps) {
  return (
    <div className="space-y-3">
      {calls.map((call) => {
        const externalPhone = call.direction === "inbound" ? call.from_number : call.to_number;
        const displayName = call.matched_customer_name || formatPhoneNumber(externalPhone);

        return (
          <Card key={call.id} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Header Row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {call.direction === "inbound" ? (
                    <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-500" />
                  )}
                  <span className="font-mono text-sm">
                    {format(parseISO(call.started_at), "h:mm a")}
                  </span>
                  <Badge variant={getStatusBadgeVariant(call.status)} className="text-xs">
                    {getStatusLabel(call.status)}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onViewCall(call)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>

              {/* Phone & Customer */}
              <div className="space-y-1 mb-3">
                <p className="font-mono text-sm text-muted-foreground">
                  {formatPhoneNumber(externalPhone)}
                </p>
                <div className="flex items-center gap-2">
                  {call.match_confidence !== "none" && (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "text-sm",
                    call.matched_customer_name ? "font-medium" : "text-muted-foreground"
                  )}>
                    {displayName}
                  </span>
                  {call.match_confidence === "partial" && (
                    <Badge variant="outline" className="text-xs">Partial</Badge>
                  )}
                </div>
              </div>

              {/* Duration & Actions */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {formatDuration(call.duration_seconds, call.status)}
                </span>
                <div className="flex items-center gap-2">
                  {call.recording_url && (
                    <CallRecordingPlayer recordingUrl={call.recording_url} />
                  )}
                  <QuickBookingPopover
                    callId={call.id}
                    isBooked={!!call.resulted_in_booking}
                    currentServiceType={call.booking_service_type}
                    onToggle={(booked, serviceType) => {
                      onToggleBooking(call.id, booked, serviceType);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
