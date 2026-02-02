import { useState, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Loader2, Calendar, Clock, User, MapPin, Lightbulb, Wrench, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import type { SchedulingSuggestion, TechnicianDistance } from "@/types/scheduling";

interface ModifySuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: SchedulingSuggestion | null;
  technicians: TechnicianDistance[];
  onConfirm: (modified: SchedulingSuggestion) => void;
  isLoading?: boolean;
  availableServices?: string[];
}

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00"
];

export function ModifySuggestionDialog({
  open,
  onOpenChange,
  suggestion,
  technicians,
  onConfirm,
  isLoading = false,
  availableServices = [],
}: ModifySuggestionDialogProps) {
  const [technicianName, setTechnicianName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);

  useEffect(() => {
    if (open && suggestion) {
      // Find the technician in the list to get the proper name for the select
      // Use case-insensitive matching for name comparison
      const matchingTech = technicians.find(t => {
        const techHcpId = t.hcpEmployeeId || (t as unknown as { id?: string }).id;
        const suggestionTechName = (suggestion.technicianName || "").toLowerCase().trim();
        const techName = (t.name || "").toLowerCase().trim();
        
        // Match by HCP ID first, then by name (case-insensitive)
        return techHcpId === suggestion.technicianId || 
               (suggestionTechName && techName && techName === suggestionTechName);
      });
      
      setTechnicianName(matchingTech?.name || suggestion.technicianName || "");
      setScheduledDate(suggestion.scheduledDate || "");
      setScheduledTime(suggestion.scheduledTime || "");
      setCustomerName(suggestion.customerName || "");
      setCustomerPhone(suggestion.customerPhone || "");
      
      // Parse services from comma-separated string
      const services = suggestion.serviceType
        ? suggestion.serviceType.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      setSelectedServices(services);
    }
  }, [open, suggestion, technicians]);

  const handleConfirm = () => {
    if (!suggestion) return;

    // Find technician ID from name
    const selectedTech = technicians.find(t => t.name === technicianName);

    const modified: SchedulingSuggestion = {
      ...suggestion,
      technicianName,
      technicianId: selectedTech?.hcpEmployeeId || (selectedTech as unknown as { id?: string })?.id,
      scheduledDate,
      scheduledTime,
      customerName,
      customerPhone,
      serviceType: selectedServices.join(", "),
    };

    onConfirm(modified);
  };

  // Toggle service selection
  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  // Generate date options for next 14 days
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE, MMM d"),
    };
  });

  // Get display text for selected services
  const selectedServicesText = selectedServices.length === 0 
    ? "Select services..." 
    : selectedServices.length === 1 
      ? selectedServices[0] 
      : `${selectedServices.length} services selected`;

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md !max-h-[90vh] !overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Modify Assignment</DialogTitle>
          <DialogDescription>
            Adjust the AI suggestion before creating the job
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto">
          {/* Services - Editable */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Services
            </Label>
            {availableServices.length > 0 ? (
              <Popover open={servicesDropdownOpen} onOpenChange={setServicesDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={servicesDropdownOpen}
                    className="w-full justify-between font-normal text-sm"
                  >
                    <span className="truncate">{selectedServicesText}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-72 p-0 z-50" 
                  align="start"
                  onPointerDownOutside={() => setServicesDropdownOpen(false)}
                  onInteractOutside={() => setServicesDropdownOpen(false)}
                >
                  <div className="p-2 border-b">
                    <p className="text-xs text-muted-foreground">
                      Select one or more services
                    </p>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {availableServices.map((service) => (
                        <div
                          key={service}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent",
                            selectedServices.includes(service) && "bg-accent"
                          )}
                          onClick={() => toggleService(service)}
                        >
                          <div className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border flex-shrink-0",
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
                      ))}
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
            ) : (
              // Fallback: show badges when no available services list
              <div className="flex flex-wrap gap-1.5">
                {selectedServices.map((service) => (
                  <Badge key={service} variant="secondary" className="text-xs">
                    {service}
                  </Badge>
                ))}
                {selectedServices.length === 0 && (
                  <span className="text-sm text-muted-foreground">No services selected</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium text-muted-foreground">Customer</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="font-medium"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium text-muted-foreground">Phone (optional)</Label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 123-4567"
              type="tel"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Address
            </Label>
            <p className="text-sm text-muted-foreground">
              {suggestion.address}, {suggestion.city}, {suggestion.state}
              {suggestion.zip && ` ${suggestion.zip}`}
            </p>
          </div>

          <Separator />

          {/* Editable Fields */}
          <div className="space-y-2">
            <Label htmlFor="technician" className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Assign To
            </Label>
            <Select value={technicianName || "unassigned"} onValueChange={(value) => setTechnicianName(value === "unassigned" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.name} value={tech.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{tech.name}</span>
                      {tech.drivingDistanceMiles !== undefined && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {tech.drivingDistanceMiles.toFixed(1)} mi • {Math.round(tech.drivingDurationMinutes || 0)} min
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Date
              </Label>
              <Select value={scheduledDate} onValueChange={setScheduledDate}>
                <SelectTrigger id="date">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Time
              </Label>
              <Select value={scheduledTime} onValueChange={setScheduledTime}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {format(parseISO(`2000-01-01T${time}:00`), "h:mm a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AI Reasoning - Read Only */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Original AI Reasoning
            </div>
            <p className="text-sm">{suggestion.reasoning}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !customerName || !scheduledDate || !scheduledTime}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Modified Job"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
