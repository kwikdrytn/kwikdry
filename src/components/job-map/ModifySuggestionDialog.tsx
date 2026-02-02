import { useState, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Loader2, Calendar, Clock, User, MapPin, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import type { SchedulingSuggestion, TechnicianDistance } from "@/types/scheduling";

interface ModifySuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: SchedulingSuggestion | null;
  technicians: TechnicianDistance[];
  onConfirm: (modified: SchedulingSuggestion) => void;
  isLoading?: boolean;
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
}: ModifySuggestionDialogProps) {
  const [technicianName, setTechnicianName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    if (open && suggestion) {
      // Find the technician in the list to get the proper name for the select
      // The suggestion may have a technicianId but the select uses technicianName
      const matchingTech = technicians.find(t => 
        t.hcpEmployeeId === suggestion.technicianId || 
        t.name === suggestion.technicianName
      );
      setTechnicianName(matchingTech?.name || suggestion.technicianName || "");
      setScheduledDate(suggestion.scheduledDate || "");
      setScheduledTime(suggestion.scheduledTime || "");
      setCustomerName(suggestion.customerName || "");
      setCustomerPhone(suggestion.customerPhone || "");
    }
  }, [open, suggestion, technicians]);

  const handleConfirm = () => {
    if (!suggestion) return;

    // Find technician ID from name
    const selectedTech = technicians.find(t => t.name === technicianName);

    const modified: SchedulingSuggestion = {
      ...suggestion,
      technicianName,
      technicianId: selectedTech?.hcpEmployeeId,
      scheduledDate,
      scheduledTime,
      customerName,
      customerPhone,
    };

    onConfirm(modified);
  };

  // Generate date options for next 14 days
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE, MMM d"),
    };
  });

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
          {/* Service & Customer Info - Read Only */}
          <div className="space-y-1">
            <Label className="text-sm font-medium text-muted-foreground">Service</Label>
            <p className="font-medium">{suggestion.serviceType}</p>
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
