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
        return <Badge className="bg-success/20 text-success hover:bg-success/20 text-[10px] px-1 py-0">High</Badge>;
      case "medium":
        return <Badge className="bg-warning/20 text-warning hover:bg-warning/20 text-[10px] px-1 py-0">Med</Badge>;
      case "low":
        return <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/20 text-[10px] px-1 py-0">Low</Badge>;
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
      className="absolute bottom-4 left-4 z-10 w-80 shadow-lg max-h-[50vh] !flex !flex-col overflow-hidden"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <CardHeader className="p-3 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-sm flex items-center gap-1.5 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="truncate">AI Suggestions</span>
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{searchedLocation.name}</span>
        </div>
      </CardHeader>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
        <div>
          {!suggestions ? (
            <div className="space-y-3">
              {/* Service Types Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs">Service Type(s)</Label>
                <Popover open={serviceDropdownOpen} onOpenChange={setServiceDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceDropdownOpen}
                      className="w-full justify-between font-normal h-8 text-xs px-2"
                    >
                      <span className="truncate">{selectedServicesText}</span>
                      <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="start">
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
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            No services found. Run HCP sync.
                          </p>
                        ) : (
                          serviceTypes.map((service) => (
                            <div
                              key={service}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-accent",
                                selectedServices.includes(service) && "bg-accent"
                              )}
                              onClick={() => toggleService(service)}
                            >
                              <div className={cn(
                                "flex h-3.5 w-3.5 items-center justify-center rounded border flex-shrink-0",
                                selectedServices.includes(service) 
                                  ? "bg-primary border-primary text-primary-foreground" 
                                  : "border-input"
                              )}>
                                {selectedServices.includes(service) && (
                                  <Check className="h-2.5 w-2.5" />
                                )}
                              </div>
                              <span className="text-xs truncate">{service}</span>
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
                          className="w-full text-xs h-7"
                          onClick={() => setSelectedServices([])}
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedServices.map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => toggleService(service)}
                      >
                        <span className="truncate max-w-[80px]">{service}</span>
                        <X className="h-2.5 w-2.5 ml-0.5 flex-shrink-0" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Duration */}
              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-xs">Duration</Label>
                <Select value={jobDuration} onValueChange={setJobDuration}>
                  <SelectTrigger id="duration" className="h-8 text-xs">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Auto-estimated from history</p>
              </div>

              {/* Advanced Options */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground">
                  <span>Advanced Options</span>
                  {showAdvanced ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {/* Preferred Days */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Preferred Days</Label>
                    <div className="grid grid-cols-2 gap-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day.value} className="flex items-center space-x-1.5">
                          <Checkbox
                            id={day.value}
                            checked={preferredDays.includes(day.value)}
                            onCheckedChange={() => toggleDay(day.value)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={day.value} className="text-[10px] cursor-pointer">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time Window */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Time Window</Label>
                    <div className="flex items-center gap-1">
                      <Select value={preferredTimeStart || "none"} onValueChange={(v) => setPreferredTimeStart(v === "none" ? "" : v)}>
                        <SelectTrigger className="flex-1 h-7 text-xs px-2">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Start</SelectItem>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time} className="text-xs">
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <Select value={preferredTimeEnd || "none"} onValueChange={(v) => setPreferredTimeEnd(v === "none" ? "" : v)}>
                        <SelectTrigger className="flex-1 h-7 text-xs px-2">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">End</SelectItem>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time} className="text-xs">
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Restrictions */}
                  <div className="space-y-1.5">
                    <Label htmlFor="restrictions" className="text-xs">Notes</Label>
                    <Textarea
                      id="restrictions"
                      placeholder="e.g., mornings only..."
                      value={restrictions}
                      onChange={(e) => setRestrictions(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Submit Button */}
              <Button
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
                className="w-full h-8 text-xs"
                size="sm"
              >
                {suggestMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Get Suggestions
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Estimated Duration from AI */}
              {suggestions.estimatedDurationMinutes && (
                <div className="bg-primary/10 rounded-md p-2 text-xs">
                  <div className="flex items-center gap-1.5 text-primary font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    Est. Duration: {Math.round(suggestions.estimatedDurationMinutes)} min
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Based on job history
                  </p>
                </div>
              )}

              {/* Technician Driving Distances */}
              {suggestions.technicians && suggestions.technicians.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" />
                    Technician Distances
                  </Label>
                  <div className="bg-muted/50 rounded-md p-2 space-y-1">
                    {suggestions.technicians.map((tech, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{tech.name}</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-[10px] flex-shrink-0">
                          {formatDrivingDistance(tech)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis Summary */}
              {suggestions.analysis && (
                <div className="bg-muted/50 rounded-md p-2 text-xs">
                  <p className="text-muted-foreground">{suggestions.analysis}</p>
                </div>
              )}

              {/* Warnings */}
              {suggestions.warnings && suggestions.warnings.length > 0 && (
                <div className="space-y-1">
                  {suggestions.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 text-[10px] text-warning bg-warning/10 rounded p-1.5"
                    >
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Suggested Times</Label>
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="border rounded-md p-2 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="font-medium text-xs">
                            {suggestion.dayName},{" "}
                            {format(parseISO(suggestion.date), "MMM d")}
                          </span>
                          {getConfidenceBadge(suggestion.confidence)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{suggestion.timeSlot}</span>
                          {suggestion.nearbyJobsCount !== undefined && (
                            <span className="text-[10px]">
                              • {suggestion.nearbyJobsCount} nearby
                            </span>
                          )}
                        </div>
                        {suggestion.suggestedTechnician && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-primary">
                            <User className="h-2.5 w-2.5" />
                            <span className="truncate">{suggestion.suggestedTechnician}</span>
                          </div>
                        )}
                        {suggestion.nearestExistingJob && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" />
                            <span className="truncate">Near: {suggestion.nearestExistingJob}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                          {suggestion.reason}
                        </p>
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Try Again */}
              <Button
                variant="outline"
                onClick={() => setSuggestions(null)}
                className="w-full h-7 text-xs"
                size="sm"
              >
                Adjust Parameters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
