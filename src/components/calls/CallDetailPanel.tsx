import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneNumber } from "@/lib/ringcentral";
import { cn } from "@/lib/utils";
import {
  Clock,
  User,
  Check,
  PhoneIncoming,
  PhoneOutgoing,
  Link2,
  MapPin,
  ExternalLink,
  Search,
  Play,
  Pause,
  Download,
  Volume2,
  Calendar,
  Briefcase,
  FileText,
  Save,
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
  recording_url: string | null;
  notes: string | null;
  synced_at: string | null;
}

interface CallDetailPanelProps {
  call: CallLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function formatAudioTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const SERVICE_TYPES = [
  "Carpet Cleaning",
  "Upholstery Cleaning",
  "Tile & Grout",
  "Water Damage",
  "Air Duct Cleaning",
  "Commercial Cleaning",
  "Other",
];

export function CallDetailPanel({ call, open, onOpenChange }: CallDetailPanelProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const audioRef = useRef<HTMLAudioElement>(null);

  // Local state for editing
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [resultedInBooking, setResultedInBooking] = useState(false);
  const [serviceType, setServiceType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when call changes
  useEffect(() => {
    if (call) {
      setResultedInBooking(call.resulted_in_booking || false);
      setServiceType(call.booking_service_type || "");
      setNotes(call.notes || "");
      setHasChanges(false);
      setIsPlaying(false);
      setAudioProgress(0);
    }
  }, [call?.id]);

  // Fetch customer details if matched
  const { data: customer } = useQuery({
    queryKey: ["hcp-customer", call?.matched_customer_id],
    queryFn: async () => {
      if (!call?.matched_customer_id) return null;

      const { data, error } = await supabase
        .from("hcp_customers")
        .select("*, hcp_service_zones(name, color)")
        .eq("hcp_customer_id", call.matched_customer_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!call?.matched_customer_id,
  });

  // Fetch linked job details
  const { data: linkedJob } = useQuery({
    queryKey: ["hcp-job", call?.linked_job_id],
    queryFn: async () => {
      if (!call?.linked_job_id) return null;

      const { data, error } = await supabase
        .from("hcp_jobs")
        .select("*")
        .eq("id", call.linked_job_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!call?.linked_job_id,
  });

  // Save changes mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!call) throw new Error("No call selected");

      const { error } = await supabase
        .from("call_log")
        .update({
          resulted_in_booking: resultedInBooking,
          booking_service_type: resultedInBooking ? serviceType : null,
          notes: notes || null,
        })
        .eq("id", call.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-log"] });
      setHasChanges(false);
      toast({
        title: "Changes saved",
        description: "Call details have been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Audio controls
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setAudioProgress(value[0]);
  };

  const handleDownload = () => {
    if (call?.recording_url) {
      window.open(call.recording_url, "_blank");
    }
  };

  // Track changes
  const handleBookingChange = (checked: boolean) => {
    setResultedInBooking(checked);
    setHasChanges(true);
  };

  const handleServiceTypeChange = (value: string) => {
    setServiceType(value);
    setHasChanges(true);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(true);
  };

  if (!call) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {call.direction === "inbound" ? (
              <PhoneIncoming className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
            ) : (
              <PhoneOutgoing className="h-5 w-5 text-sky-600 dark:text-sky-500" />
            )}
            Call Details
          </SheetTitle>
          <SheetDescription>
            {format(parseISO(call.started_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Call Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Direction</p>
                <p className="font-medium capitalize">{call.direction}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDuration(call.duration_seconds, call.status)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={getStatusBadgeVariant(call.status)} className="mt-0.5">
                  {getStatusLabel(call.status)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Phone Numbers */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Phone Numbers</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">From</p>
                <p className="font-mono text-sm">{formatPhoneNumber(call.from_number)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="font-mono text-sm">{formatPhoneNumber(call.to_number)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Match */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Match
            </h4>
            {call.matched_customer_name ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-lg">{call.matched_customer_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {formatPhoneNumber(call.matched_customer_phone)}
                    </p>
                  </div>
                  <Badge variant={call.match_confidence === "exact" ? "default" : "secondary"}>
                    {call.match_confidence === "exact" ? "Exact Match" : "Partial Match"}
                  </Badge>
                </div>

                {customer && (
                  <>
                    {(customer.address || customer.city || customer.state) && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>
                          {[customer.address, customer.city, customer.state, customer.zip]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}

                    {customer.hcp_service_zones && (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: customer.hcp_service_zones.color || "#888" }}
                        />
                        <span className="text-sm">{customer.hcp_service_zones.name}</span>
                      </div>
                    )}
                  </>
                )}

                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Customer in HouseCall Pro
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">No customer match found</p>
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Search Customers
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Linked Job */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Linked Job
            </h4>
            {linkedJob ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {linkedJob.services && Array.isArray(linkedJob.services) 
                          ? (linkedJob.services as Array<{name?: string}>)[0]?.name || "Service"
                          : "Job"}
                      </span>
                    </div>
                    {linkedJob.scheduled_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(linkedJob.scheduled_date), "MMM d, yyyy")}
                        {linkedJob.scheduled_time && ` at ${linkedJob.scheduled_time}`}
                      </div>
                    )}
                  </div>
                  {linkedJob.status && (
                    <Badge variant="outline" className="capitalize">
                      {linkedJob.status}
                    </Badge>
                  )}
                </div>

                {linkedJob.customer_name && (
                  <p className="text-sm text-muted-foreground">{linkedJob.customer_name}</p>
                )}

                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Job in HouseCall Pro
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">No linked job</p>
              </div>
            )}
          </div>

          {/* Recording (Admin only) */}
          {isAdmin && call.recording_url && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Recording
                </h4>
                <div className="rounded-lg border p-4 space-y-4">
                  <audio
                    ref={audioRef}
                    src={call.recording_url}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>

                    <div className="flex-1 space-y-1">
                      <Slider
                        value={[audioProgress]}
                        max={audioDuration || 100}
                        step={1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatAudioTime(audioProgress)}</span>
                        <span>{formatAudioTime(audioDuration)}</span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                      title="Download recording"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Booking Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Check className="h-4 w-4" />
              Booking Status
            </h4>
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="booking-toggle" className="text-sm font-normal">
                  This call resulted in a booking
                </Label>
                <Switch
                  id="booking-toggle"
                  checked={resultedInBooking}
                  onCheckedChange={handleBookingChange}
                />
              </div>

              {resultedInBooking && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="service-type" className="text-sm">
                      Service Type
                    </Label>
                    <Select value={serviceType} onValueChange={handleServiceTypeChange}>
                      <SelectTrigger id="service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </h4>
            <Textarea
              placeholder="Add notes about this call..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
            <p>RC Call ID: {call.rc_call_id}</p>
            {call.synced_at && (
              <p>Last synced: {format(parseISO(call.synced_at), "MMM d, yyyy h:mm a")}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
