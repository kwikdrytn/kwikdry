import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { 
  Sparkles, 
  Clock, 
  MapPin, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Car,
  User,
  Target,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceTypes, useTechnicians } from "@/hooks/useJobMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModifySuggestionDialog } from "./ModifySuggestionDialog";
import { SchedulingSuggestionCard } from "./SchedulingSuggestionCard";
import type { 
  SchedulingSuggestion, 
  TechnicianDistance, 
  SuggestionResponse,
  CreateJobResponse 
} from "@/types/scheduling";

interface BookingSuggestionPanelProps {
  searchedLocation: { coords: [number, number]; name: string } | null;
  onClose: () => void;
  onCollapseFilters?: () => void;
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

export function BookingSuggestionPanel({ searchedLocation, onClose, onCollapseFilters }: BookingSuggestionPanelProps) {
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

  const normalizeName = (name: string | undefined | null) => (name || "").trim().toLowerCase();
  const hcpTechIdByName = useMemo(() => {
    return new Map(hcpTechnicians.map((t) => [normalizeName(t.name), t.id] as const));
  }, [hcpTechnicians]);

  // Build technician list for the dialog
  const technicianDistances = useMemo((): TechnicianDistance[] => {
    // If the edge function returns an empty technicians array, fall back to our synced HCP employees.
    if (aiResponse?.technicians && aiResponse.technicians.length > 0) {
      return aiResponse.technicians.map((t) => {
        const resolvedId =
          t.hcpEmployeeId ||
          hcpTechIdByName.get(normalizeName(t.name));
        return {
          ...t,
          hcpEmployeeId: resolvedId,
        };
      });
    }
    return hcpTechnicians.map(t => ({
      name: t.name,
      hcpEmployeeId: t.id,
    }));
  }, [aiResponse?.technicians, hcpTechnicians, hcpTechIdByName]);

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
      
      const structured = data.suggestions.map((s, idx): SchedulingSuggestion => {
        // Robust technician ID lookup with fallback to partial matching
        let techId = hcpTechIdByName.get(normalizeName(s.suggestedTechnician));
        
        // If exact match failed, try partial matching
        if (!techId && s.suggestedTechnician) {
          const suggestedNorm = normalizeName(s.suggestedTechnician);
          for (const [techName, id] of hcpTechIdByName.entries()) {
            if (techName.includes(suggestedNorm) || suggestedNorm.includes(techName)) {
              techId = id;
              break;
            }
          }
        }
        
        // Use selected services, or fallback to first available service from price book
        const effectiveServices = selectedServices.length > 0 
          ? selectedServices.join(", ")
          : (serviceTypes.length > 0 ? serviceTypes[0] : "");
        
        return {
          id: `suggestion-${idx}-${Date.now()}`,
          technicianName: s.suggestedTechnician || "Unassigned",
          technicianId: techId,
          serviceType: effectiveServices,
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
        };
      });
      
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
        className={cn(
          "absolute bottom-4 left-4 right-4 z-10 shadow-lg !flex !flex-col overflow-hidden transition-all duration-200",
          hasResults ? "" : showAdvanced ? "max-h-72" : "max-h-44"
        )}
        onWheelCapture={(e) => e.stopPropagation()}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onTouchMoveCapture={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <CardHeader className="p-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <CardTitle className="text-sm flex items-center gap-1.5 flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>AI Suggestions</span>
              </CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{searchedLocation.name}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
          {!hasResults ? (
            <div className="space-y-3">
              {/* Horizontal form layout */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Customer Name */}
                <div className="space-y-1 min-w-[140px] flex-1">
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
                <div className="space-y-1 min-w-[180px] flex-1">
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
                    <PopoverContent className="w-auto min-w-64 max-w-md p-0 z-50" align="start" onPointerDownOutside={() => setServiceDropdownOpen(false)} onInteractOutside={() => setServiceDropdownOpen(false)}>
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
                                <span className="text-xs whitespace-nowrap">{service}</span>
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
                </div>

                {/* Job Duration */}
                <div className="space-y-1 min-w-[120px]">
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
                </div>

                {/* Advanced Options Toggle */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground px-2">
                      Advanced
                      {showAdvanced ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>

                {/* Submit Button */}
                <Button
                  onClick={() => {
                    onCollapseFilters?.();
                    suggestMutation.mutate();
                  }}
                  disabled={suggestMutation.isPending}
                  className="h-8 text-xs px-4"
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

              {/* Selected Services Badges */}
              {selectedServices.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedServices.map((service) => (
                    <Badge
                      key={service}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => toggleService(service)}
                    >
                      <span className="truncate max-w-[120px]">{service}</span>
                      <X className="h-2.5 w-2.5 ml-0.5 flex-shrink-0" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Advanced Options (Collapsible) */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleContent>
                  <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
                    {/* Preferred Days */}
                    <div className="space-y-1">
                      <Label className="text-xs">Preferred Days</Label>
                      <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => (
                          <Button
                            key={day.value}
                            variant={preferredDays.includes(day.value) ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => toggleDay(day.value)}
                          >
                            {day.label.slice(0, 3)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Time Window */}
                    <div className="space-y-1 min-w-[160px]">
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

                    {/* Notes */}
                    <div className="space-y-1 flex-1 min-w-[200px]">
                      <Label htmlFor="restrictions" className="text-xs">Notes</Label>
                      <input
                        id="restrictions"
                        type="text"
                        placeholder="e.g., mornings only..."
                        value={restrictions}
                        onChange={(e) => setRestrictions(e.target.value)}
                        className="w-full h-7 px-2 text-xs rounded-md border border-input bg-background"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Results Header Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Create All Button */}
                {pendingCount > 1 && (
                  <Button
                    onClick={handleCreateAll}
                    disabled={creatingAllProgress !== null}
                    className="h-7 text-xs"
                    size="sm"
                  >
                    {creatingAllProgress ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Creating {creatingAllProgress.current}/{creatingAllProgress.total}...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Create All ({pendingCount})
                      </>
                    )}
                  </Button>
                )}

                {/* Estimated Duration from AI */}
                {aiResponse?.estimatedDurationMinutes && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Clock className="h-3.5 w-3.5" />
                    Est. Duration: {Math.round(aiResponse.estimatedDurationMinutes)} min
                  </div>
                )}

                {/* Warnings */}
                {aiResponse?.warnings && aiResponse.warnings.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-warning">
                    <AlertCircle className="h-3 w-3" />
                    {aiResponse.warnings.length} warning{aiResponse.warnings.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Adjust Parameters */}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAiResponse(null);
                    setStructuredSuggestions([]);
                  }}
                  className="h-7 text-xs ml-auto"
                  size="sm"
                >
                  Adjust
                </Button>
              </div>

              {/* Horizontal Scrollable Suggestion Cards */}
              <div className="flex gap-3 overflow-x-auto pb-1">
                {/* Technician Distances Card */}
                {aiResponse?.technicians && aiResponse.technicians.length > 0 && (
                  <div className="flex-shrink-0 bg-muted/50 rounded-md p-2 min-w-[160px]">
                    <Label className="text-[10px] font-medium flex items-center gap-1 mb-1.5">
                      <Car className="h-3 w-3" />
                      Tech Distances
                    </Label>
                    <div className="space-y-0.5">
                      {aiResponse.technicians.slice(0, 4).map((tech, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <span className="truncate max-w-[80px]">{tech.name}</span>
                          <span className="text-muted-foreground font-mono">
                            {formatDrivingDistance(tech)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestion Cards */}
                {structuredSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex-shrink-0 w-64">
                    <SchedulingSuggestionCard
                      suggestion={suggestion}
                      onCreateJob={handleCreateJob}
                      onModify={handleModify}
                      onRetry={handleRetry}
                      isDisabled={creatingJobId !== null || creatingAllProgress !== null}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
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
        availableServices={serviceTypes}
      />
    </>
  );
}
