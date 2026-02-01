import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTechnicians, useServiceTypes } from "@/hooks/useJobMap";

interface MapFiltersProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  technicianFilter: string;
  onTechnicianChange: (value: string) => void;
  serviceFilter: string;
  onServiceChange: (value: string) => void;
}

export function MapFilters({
  selectedDate,
  onDateChange,
  technicianFilter,
  onTechnicianChange,
  serviceFilter,
  onServiceChange,
}: MapFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: technicians } = useTechnicians();
  const { data: serviceTypes } = useServiceTypes();

  return (
    <Card className="absolute top-4 left-4 z-10 w-72 shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-8 text-sm",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && onDateChange(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Technician Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Technician</Label>
              <Select value={technicianFilter} onValueChange={onTechnicianChange}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians?.map((tech) => (
                    <SelectItem key={tech.hcp_employee_id} value={tech.hcp_employee_id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Type Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Service Type</Label>
              <Select value={serviceFilter} onValueChange={onServiceChange}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {serviceTypes?.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
