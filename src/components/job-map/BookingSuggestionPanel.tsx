import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  MapPin, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BookingSuggestionPanelProps {
  searchedLocation: { coords: [number, number]; name: string } | null;
  onClose: () => void;
}

interface Suggestion {
  date: string;
  dayName: string;
  timeSlot: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  nearbyJobsCount?: number;
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  analysis: string;
  warnings?: string[];
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const TIME_OPTIONS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

export function BookingSuggestionPanel({ searchedLocation, onClose }: BookingSuggestionPanelProps) {
  const { profile } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Form state
  const [jobDuration, setJobDuration] = useState("60");
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimeStart, setPreferredTimeStart] = useState("");
  const [preferredTimeEnd, setPreferredTimeEnd] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [serviceName, setServiceName] = useState("");
  
  // Results state
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);

  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!searchedLocation || !profile?.organization_id) {
        throw new Error("Missing required data");
      }

      const { data, error } = await supabase.functions.invoke("suggest-job-time", {
        body: {
          organizationId: profile.organization_id,
          address: searchedLocation.name,
          coordinates: {
            lng: searchedLocation.coords[0],
            lat: searchedLocation.coords[1],
          },
          jobDurationMinutes: parseInt(jobDuration) || 60,
          preferredDays: preferredDays.length > 0 ? preferredDays : undefined,
          preferredTimeStart: preferredTimeStart || undefined,
          preferredTimeEnd: preferredTimeEnd || undefined,
          restrictions: restrictions || undefined,
          serviceName: serviceName || undefined,
        },
      });

      if (error) throw error;
      return data as SuggestionResponse;
    },
    onSuccess: (data) => {
      setSuggestions(data);
    },
    onError: (error: any) => {
      console.error("Suggestion error:", error);
      if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
        toast.error("Rate limit exceeded. Please try again in a moment.");
      } else if (error.message?.includes("402")) {
        toast.error("AI credits exhausted. Please add funds to continue.");
      } else {
        toast.error("Failed to get suggestions. Please try again.");
      }
    },
  });

  const toggleDay = (day: string) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
      case "low":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low</Badge>;
      default:
        return null;
    }
  };

  if (!searchedLocation) return null;

  return (
    <Card className="absolute bottom-4 left-4 z-10 w-96 shadow-lg max-h-[70vh] flex flex-col overflow-hidden">
      <CardHeader className="p-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Booking Suggestions
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{searchedLocation.name}</span>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full max-h-[calc(70vh-80px)]">
          <CardContent className="p-4 pt-2">
          {!suggestions ? (
            <div className="space-y-4">
              {/* Job Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm">
                  Estimated Job Duration
                </Label>
                <Select value={jobDuration} onValueChange={setJobDuration}>
                  <SelectTrigger id="duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">Full day (8 hours)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Service Name */}
              <div className="space-y-2">
                <Label htmlFor="service" className="text-sm">
                  Service Type (optional)
                </Label>
                <Input
                  id="service"
                  placeholder="e.g., Carpet Cleaning, Deep Clean"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>

              {/* Advanced Options */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground">
                  <span>Advanced Options</span>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  {/* Preferred Days */}
                  <div className="space-y-2">
                    <Label className="text-sm">Preferred Days</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={day.value}
                            checked={preferredDays.includes(day.value)}
                            onCheckedChange={() => toggleDay(day.value)}
                          />
                          <Label htmlFor={day.value} className="text-xs cursor-pointer">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time Window */}
                  <div className="space-y-2">
                    <Label className="text-sm">Preferred Time Window</Label>
                    <div className="flex items-center gap-2">
                      <Select value={preferredTimeStart} onValueChange={setPreferredTimeStart}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <Select value={preferredTimeEnd} onValueChange={setPreferredTimeEnd}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Restrictions */}
                  <div className="space-y-2">
                    <Label htmlFor="restrictions" className="text-sm">
                      Restrictions / Notes
                    </Label>
                    <Textarea
                      id="restrictions"
                      placeholder="e.g., Customer only available mornings, avoid Wednesdays..."
                      value={restrictions}
                      onChange={(e) => setRestrictions(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Submit Button */}
              <Button
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
                className="w-full"
              >
                {suggestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Schedule...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Analysis Summary */}
              {suggestions.analysis && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">{suggestions.analysis}</p>
                </div>
              )}

              {/* Warnings */}
              {suggestions.warnings && suggestions.warnings.length > 0 && (
                <div className="space-y-1">
                  {suggestions.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded p-2"
                    >
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Suggested Times</Label>
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">
                            {suggestion.dayName},{" "}
                            {format(parseISO(suggestion.date), "MMM d")}
                          </span>
                          {getConfidenceBadge(suggestion.confidence)}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{suggestion.timeSlot}</span>
                          {suggestion.nearbyJobsCount !== undefined && (
                            <span className="text-xs">
                              • {suggestion.nearbyJobsCount} nearby jobs
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {suggestion.reason}
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Try Again */}
              <Button
                variant="outline"
                onClick={() => setSuggestions(null)}
                className="w-full"
              >
                Adjust Parameters
              </Button>
            </div>
          )}
        </CardContent>
        </ScrollArea>
      </div>
    </Card>
  );
}
