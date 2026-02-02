import { useState, useEffect, useMemo } from "react";
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
  X,
  Car,
  User,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceTypes } from "@/hooks/useJobMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  suggestedTechnician?: string;
  nearestExistingJob?: string;
}

interface TechnicianDistance {
  name: string;
  drivingDistanceMiles?: number;
  drivingDurationMinutes?: number;
  straightLineDistance?: number;
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  analysis: string;
  warnings?: string[];
  technicians?: TechnicianDistance[];
  estimatedDurationMinutes?: number;
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

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
  { value: "180", label: "3 hours" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "Full day (8 hours)" },
];

export function BookingSuggestionPanel({ searchedLocation, onClose }: BookingSuggestionPanelProps) {
  const { profile } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  
  // Form state
  const [jobDuration, setJobDuration] = useState("60");
  const [isAutoEstimating, setIsAutoEstimating] = useState(false);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimeStart, setPreferredTimeStart] = useState("");
  const [preferredTimeEnd, setPreferredTimeEnd] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  // Results state
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);

  // Fetch service types from price book
  const { data: serviceTypes = [], isLoading: servicesLoading } = useServiceTypes();

  // Toggle service selection
  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  // Get display text for selected services
  const selectedServicesText = useMemo(() => {
    if (selectedServices.length === 0) return "Select services...";
    if (selectedServices.length === 1) return selectedServices[0];
    if (selectedServices.length === 2) return selectedServices.join(", ");
    return `${selectedServices.length} services selected`;
  }, [selectedServices]);

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
          serviceNames: selectedServices.length > 0 ? selectedServices : undefined,
          estimateDuration: true,
        },
      });

      if (error) throw error;
      return data as SuggestionResponse;
    },
    onSuccess: (data) => {
      setSuggestions(data);
      // Update duration if AI estimated it
      if (data.estimatedDurationMinutes) {
        const closest = DURATION_OPTIONS.reduce((prev, curr) => {
          const prevDiff = Math.abs(parseInt(prev.value) - data.estimatedDurationMinutes!);
          const currDiff = Math.abs(parseInt(curr.value) - data.estimatedDurationMinutes!);
          return currDiff < prevDiff ? curr : prev;
        });
        setJobDuration(closest.value);
      }
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

  const formatDrivingDistance = (tech: TechnicianDistance) => {
    if (tech.drivingDistanceMiles !== undefined && tech.drivingDurationMinutes !== undefined) {
      return `${tech.drivingDistanceMiles.toFixed(1)} mi • ${Math.round(tech.drivingDurationMinutes)} min`;
    }
    if (tech.straightLineDistance !== undefined) {
      return `~${tech.straightLineDistance.toFixed(1)} mi`;
    }
    return "Unknown";
  };

  if (!searchedLocation) return null;

  return (
    <Card
      className="absolute bottom-4 left-4 z-10 w-96 shadow-lg h-[70dvh] max-h-[70dvh] flex flex-col"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <CardHeader className="p-4 pb-2 shrink-0">
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

      <ScrollArea className="flex-1 min-h-0 h-full">
        <CardContent className="p-4 pt-2">
          {!suggestions ? (
            <div className="space-y-4">
              {/* Service Types Multi-Select */}
              <div className="space-y-2">
                <Label className="text-sm">Service Type(s)</Label>
                <Popover open={serviceDropdownOpen} onOpenChange={setServiceDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceDropdownOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">{selectedServicesText}</span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-2 border-b">
                      <p className="text-xs text-muted-foreground">
                        Select one or more services
                      </p>
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="p-2 space-y-1">
                        {servicesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : serviceTypes.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No services found. Run HCP sync to import services.
                          </p>
                        ) : (
                          serviceTypes.map((service) => (
                            <div
                              key={service}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent",
                                selectedServices.includes(service) && "bg-accent"
                              )}
                              onClick={() => toggleService(service)}
                            >
                              <div className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border",
                                selectedServices.includes(service) 
                                  ? "bg-primary border-primary text-primary-foreground" 
                                  : "border-input"
                              )}>
                                {selectedServices.includes(service) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                              <span className="text-sm truncate">{service}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    {selectedServices.length > 0 && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setSelectedServices([])}
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedServices.map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => toggleService(service)}
                      >
                        {service}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Duration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="duration" className="text-sm">
                    Estimated Job Duration
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    (auto-estimated from job history)
                  </span>
                </div>
                <Select value={jobDuration} onValueChange={setJobDuration}>
                  <SelectTrigger id="duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      <Select value={preferredTimeStart || "none"} onValueChange={(v) => setPreferredTimeStart(v === "none" ? "" : v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Start</SelectItem>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <Select value={preferredTimeEnd || "none"} onValueChange={(v) => setPreferredTimeEnd(v === "none" ? "" : v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">End</SelectItem>
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
              {/* Estimated Duration from AI */}
              {suggestions.estimatedDurationMinutes && (
                <div className="bg-primary/10 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Clock className="h-4 w-4" />
                    Estimated Duration: {Math.round(suggestions.estimatedDurationMinutes)} min
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on similar jobs in your history
                  </p>
                </div>
              )}

              {/* Technician Driving Distances */}
              {suggestions.technicians && suggestions.technicians.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Technician Driving Distances
                  </Label>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    {suggestions.technicians.map((tech, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{tech.name}</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-xs">
                          {formatDrivingDistance(tech)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                        {suggestion.suggestedTechnician && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                            <User className="h-3 w-3" />
                            <span>{suggestion.suggestedTechnician}</span>
                          </div>
                        )}
                        {suggestion.nearestExistingJob && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>Near: {suggestion.nearestExistingJob}</span>
                          </div>
                        )}
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
    </Card>
  );
}
