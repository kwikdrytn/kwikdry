import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO, addDays } from "date-fns";
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
  Check,
  ExternalLink,
  Target,
  Lightbulb,
  Edit2,
  RotateCcw
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
import { useServiceTypes, useTechnicians } from "@/hooks/useJobMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModifySuggestionDialog } from "./ModifySuggestionDialog";
import type { 
  SchedulingSuggestion, 
  TechnicianDistance, 
  SuggestionResponse,
  CreateJobResponse 
} from "@/types/scheduling";

interface BookingSuggestionPanelProps {
  searchedLocation: { coords: [number, number]; name: string } | null;
  onClose: () => void;
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

// Parse address into components
function parseAddressComponents(fullAddress: string): { address: string; city: string; state: string; zip?: string } {
  // Try to parse "123 Main St, City, ST 12345" format
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const address = parts[0];
    const city = parts[1];
    const stateZipMatch = parts[2].match(/([A-Z]{2})\s*(\d{5})?/);
    if (stateZipMatch) {
      return {
        address,
        city,
        state: stateZipMatch[1],
        zip: stateZipMatch[2] || undefined,
      };
    }
    return { address, city, state: parts[2] };
  }
  
  if (parts.length === 2) {
    return { address: parts[0], city: parts[1], state: 'TN' };
  }
  
  return { address: fullAddress, city: 'Unknown', state: 'TN' };
}

// Parse time slot to get start time
function parseTimeSlot(timeSlot: string): string {
  // Extract first time from formats like "09:00-11:00" or "9:00 AM - 11:00 AM"
  const match = timeSlot.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    return `${hours}:${match[2]}`;
  }
  return "09:00";
}

export function BookingSuggestionPanel({ searchedLocation, onClose }: BookingSuggestionPanelProps) {
  const { profile } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  
  // Form state
  const [jobDuration, setJobDuration] = useState("60");
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimeStart, setPreferredTimeStart] = useState("");
  const [preferredTimeEnd, setPreferredTimeEnd] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  
  // Results state
  const [aiResponse, setAiResponse] = useState<SuggestionResponse | null>(null);
  const [structuredSuggestions, setStructuredSuggestions] = useState<SchedulingSuggestion[]>([]);
  
  // Modal state
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SchedulingSuggestion | null>(null);
  const [creatingJobId, setCreatingJobId] = useState<string | null>(null);
  const [creatingAllProgress, setCreatingAllProgress] = useState<{ current: number; total: number } | null>(null);

  // Fetch service types from price book
  const { data: serviceTypes = [], isLoading: servicesLoading } = useServiceTypes();
  
  // Fetch technicians with HCP IDs
  const { data: hcpTechnicians = [] } = useTechnicians();

  // Build technician list for the dialog
  const technicianDistances = useMemo((): TechnicianDistance[] => {
    if (aiResponse?.technicians) {
      return aiResponse.technicians.map(t => ({
        ...t,
        hcpEmployeeId: hcpTechnicians.find(ht => ht.name === t.name)?.id,
      }));
    }
    return hcpTechnicians.map(t => ({
      name: t.name,
      hcpEmployeeId: t.id,
    }));
  }, [aiResponse?.technicians, hcpTechnicians]);

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
      setAiResponse(data);
      
      // Parse AI suggestions into structured data
      const addressParts = searchedLocation ? parseAddressComponents(searchedLocation.name) : { address: '', city: '', state: 'TN' };
      
      const structured = data.suggestions.map((s, idx): SchedulingSuggestion => ({
        id: `suggestion-${idx}-${Date.now()}`,
        technicianName: s.suggestedTechnician || "Unassigned",
        technicianId: hcpTechnicians.find(t => t.name === s.suggestedTechnician)?.id,
        serviceType: selectedServices.join(", ") || "General Service",
        customerName: customerName || "New Customer",
        address: addressParts.address,
        city: addressParts.city,
        state: addressParts.state,
        zip: addressParts.zip,
        scheduledDate: s.date,
        scheduledTime: parseTimeSlot(s.timeSlot),
        duration: data.estimatedDurationMinutes || parseInt(jobDuration) || 60,
        reasoning: s.reason,
        confidence: s.confidence,
        nearbyJobsCount: s.nearbyJobsCount,
        nearestExistingJob: s.nearestExistingJob,
        skillMatch: s.skillMatch,
        status: 'pending',
      }));
      
      setStructuredSuggestions(structured);
      
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

  const createJobMutation = useMutation({
    mutationFn: async (suggestion: SchedulingSuggestion) => {
      if (!profile?.organization_id || !searchedLocation) {
        throw new Error("Missing required data");
      }

      const { data, error } = await supabase.functions.invoke("create-hcp-job", {
        body: {
          organizationId: profile.organization_id,
          customerName: suggestion.customerName,
          customerPhone: suggestion.customerPhone,
          address: suggestion.address,
          city: suggestion.city,
          state: suggestion.state,
          zip: suggestion.zip,
          scheduledDate: suggestion.scheduledDate,
          scheduledTime: suggestion.scheduledTime,
          duration: suggestion.duration,
          serviceType: suggestion.serviceType,
          technicianHcpId: suggestion.technicianId,
          coordinates: {
            lng: searchedLocation.coords[0],
            lat: searchedLocation.coords[1],
          },
        },
      });

      if (error) throw error;
      return { ...(data as CreateJobResponse), suggestionId: suggestion.id };
    },
    onSuccess: (data) => {
      // Update the suggestion with success status
      setStructuredSuggestions(prev => prev.map(s => 
        s.id === data.suggestionId 
          ? { ...s, status: 'created' as const, hcpJobId: data.hcpJobId, hcpJobUrl: data.hcpJobUrl }
          : s
      ));
      setCreatingJobId(null);
      toast.success("Job created successfully!");
    },
    onError: (error: any, variables) => {
      console.error("Create job error:", error);
      // Update the suggestion with error status
      setStructuredSuggestions(prev => prev.map(s => 
        s.id === variables.id 
          ? { ...s, status: 'error' as const, error: error.message }
          : s
      ));
      setCreatingJobId(null);
      toast.error(`Failed to create job: ${error.message}`);
    },
  });

  const handleCreateJob = async (suggestion: SchedulingSuggestion) => {
    setCreatingJobId(suggestion.id);
    setStructuredSuggestions(prev => prev.map(s => 
      s.id === suggestion.id ? { ...s, status: 'creating' as const } : s
    ));
    createJobMutation.mutate(suggestion);
  };

  const handleModify = (suggestion: SchedulingSuggestion) => {
    setSelectedSuggestion(suggestion);
    setModifyDialogOpen(true);
  };

  const handleModifyConfirm = (modified: SchedulingSuggestion) => {
    setModifyDialogOpen(false);
    handleCreateJob(modified);
  };

  const handleCreateAll = async () => {
    const pendingSuggestions = structuredSuggestions.filter(s => s.status === 'pending');
    if (pendingSuggestions.length === 0) return;

    setCreatingAllProgress({ current: 0, total: pendingSuggestions.length });

    for (let i = 0; i < pendingSuggestions.length; i++) {
      setCreatingAllProgress({ current: i + 1, total: pendingSuggestions.length });
      
      try {
        const suggestion = pendingSuggestions[i];
        setStructuredSuggestions(prev => prev.map(s => 
          s.id === suggestion.id ? { ...s, status: 'creating' as const } : s
        ));
        
        const { data, error } = await supabase.functions.invoke("create-hcp-job", {
          body: {
            organizationId: profile?.organization_id,
            customerName: suggestion.customerName,
            customerPhone: suggestion.customerPhone,
            address: suggestion.address,
            city: suggestion.city,
            state: suggestion.state,
            zip: suggestion.zip,
            scheduledDate: suggestion.scheduledDate,
            scheduledTime: suggestion.scheduledTime,
            duration: suggestion.duration,
            serviceType: suggestion.serviceType,
            technicianHcpId: suggestion.technicianId,
            coordinates: searchedLocation ? {
              lng: searchedLocation.coords[0],
              lat: searchedLocation.coords[1],
            } : undefined,
          },
        });

        if (error) throw error;
        
        const response = data as CreateJobResponse;
        setStructuredSuggestions(prev => prev.map(s => 
          s.id === suggestion.id 
            ? { ...s, status: 'created' as const, hcpJobId: response.hcpJobId, hcpJobUrl: response.hcpJobUrl }
            : s
        ));
      } catch (err: any) {
        setStructuredSuggestions(prev => prev.map(s => 
          s.id === pendingSuggestions[i].id 
            ? { ...s, status: 'error' as const, error: err.message }
            : s
        ));
      }
    }

    setCreatingAllProgress(null);
    toast.success(`Finished creating jobs!`);
  };

  const handleRetry = (suggestion: SchedulingSuggestion) => {
    setStructuredSuggestions(prev => prev.map(s => 
      s.id === suggestion.id ? { ...s, status: 'pending' as const, error: undefined } : s
    ));
  };

  const toggleDay = (day: string) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <Badge className="bg-success/20 text-success hover:bg-success/20 text-[10px] px-1.5 py-0">●●●</Badge>;
      case "medium":
        return <Badge className="bg-warning/20 text-warning hover:bg-warning/20 text-[10px] px-1.5 py-0">●●○</Badge>;
      case "low":
        return <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/20 text-[10px] px-1.5 py-0">●○○</Badge>;
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

  const pendingCount = structuredSuggestions.filter(s => s.status === 'pending').length;
  const hasResults = structuredSuggestions.length > 0;

  if (!searchedLocation) return null;

  return (
    <>
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
            {!hasResults ? (
              <div className="space-y-3">
                {/* Customer Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Name</Label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background"
                  />
                </div>

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
                {/* Create All Button */}
                {pendingCount > 1 && (
                  <Button
                    onClick={handleCreateAll}
                    disabled={creatingAllProgress !== null}
                    className="w-full h-8 text-xs"
                    size="sm"
                  >
                    {creatingAllProgress ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Creating job {creatingAllProgress.current} of {creatingAllProgress.total}...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Create All Recommended Jobs ({pendingCount})
                      </>
                    )}
                  </Button>
                )}

                {/* Estimated Duration from AI */}
                {aiResponse?.estimatedDurationMinutes && (
                  <div className="bg-primary/10 rounded-md p-2 text-xs">
                    <div className="flex items-center gap-1.5 text-primary font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      Est. Duration: {Math.round(aiResponse.estimatedDurationMinutes)} min
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Based on job history
                    </p>
                  </div>
                )}

                {/* Technician Driving Distances */}
                {aiResponse?.technicians && aiResponse.technicians.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" />
                      Technician Distances
                    </Label>
                    <div className="bg-muted/50 rounded-md p-2 space-y-1">
                      {aiResponse.technicians.map((tech, idx) => (
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

                {/* Warnings */}
                {aiResponse?.warnings && aiResponse.warnings.length > 0 && (
                  <div className="space-y-1">
                    {aiResponse.warnings.map((warning, idx) => (
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

                {/* Actionable Suggestion Cards */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Recommended Assignments
                  </Label>
                  
                  {structuredSuggestions.map((suggestion, idx) => (
                    <div
                      key={suggestion.id}
                      className={cn(
                        "border rounded-lg p-2.5 transition-colors",
                        suggestion.status === 'created' && "border-success bg-success/5",
                        suggestion.status === 'error' && "border-destructive bg-destructive/5",
                        suggestion.status === 'creating' && "opacity-70"
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {suggestion.status === 'created' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                          ) : (
                            <Target className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">
                            {suggestion.status === 'created' ? 'Created' : 'Recommended'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Confidence:</span>
                          {getConfidenceBadge(suggestion.confidence)}
                        </div>
                      </div>

                      {/* Service Type */}
                      <div className="text-sm font-medium truncate">{suggestion.serviceType}</div>
                      
                      {/* Customer */}
                      <div className="text-xs text-muted-foreground mt-1">
                        Customer: {suggestion.customerName}
                      </div>
                      
                      {/* Address */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {suggestion.address}, {suggestion.city}, {suggestion.state}
                        </span>
                      </div>
                      
                      {/* Date/Time */}
                      <div className="flex items-center gap-1.5 text-xs mt-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {format(parseISO(suggestion.scheduledDate), "MMM d, yyyy")} at{" "}
                          {format(parseISO(`2000-01-01T${suggestion.scheduledTime}:00`), "h:mm a")}
                        </span>
                      </div>
                      
                      {/* Assigned Technician */}
                      <div className="flex items-center gap-1 text-xs text-primary mt-1">
                        <User className="h-3 w-3" />
                        <span>→ Assign to: {suggestion.technicianName}</span>
                      </div>
                      
                      {/* AI Reasoning */}
                      <div className="flex items-start gap-1 text-[10px] text-muted-foreground mt-2 bg-muted/50 rounded p-1.5">
                        <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{suggestion.reasoning}</span>
                      </div>

                      {/* Error Message */}
                      {suggestion.status === 'error' && suggestion.error && (
                        <div className="flex items-start gap-1 text-[10px] text-destructive mt-2 bg-destructive/10 rounded p-1.5">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{suggestion.error}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        {suggestion.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleCreateJob(suggestion)}
                              disabled={creatingJobId !== null || creatingAllProgress !== null}
                            >
                              {creatingJobId === suggestion.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Create Job
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={() => handleModify(suggestion)}
                              disabled={creatingJobId !== null || creatingAllProgress !== null}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        
                        {suggestion.status === 'creating' && (
                          <div className="flex-1 flex items-center justify-center h-7 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Creating...
                          </div>
                        )}
                        
                        {suggestion.status === 'created' && suggestion.hcpJobUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                            asChild
                          >
                            <a href={suggestion.hcpJobUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              View in HouseCall Pro
                            </a>
                          </Button>
                        )}
                        
                        {suggestion.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleRetry(suggestion)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Try Again */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setAiResponse(null);
                    setStructuredSuggestions([]);
                  }}
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

      {/* Modify Dialog */}
      <ModifySuggestionDialog
        open={modifyDialogOpen}
        onOpenChange={setModifyDialogOpen}
        suggestion={selectedSuggestion}
        technicians={technicianDistances}
        onConfirm={handleModifyConfirm}
        isLoading={createJobMutation.isPending}
      />
    </>
  );
}
