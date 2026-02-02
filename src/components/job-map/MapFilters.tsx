import { useState } from "react";
import { format, addDays } from "date-fns";
import { 
  CalendarIcon, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  X, 
  CalendarDays,
  User,
  CircleDot,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddressSearch } from "./AddressSearch";
import { 
  MapFilters as MapFiltersType, 
  DEFAULT_FILTERS, 
  JOB_STATUSES,
  useTechnicians, 
  countActiveFilters
} from "@/hooks/useJobMap";

interface MapFiltersProps {
  filters: MapFiltersType;
  onFiltersChange: (filters: MapFiltersType) => void;
  onLocationSelect?: (coords: [number, number], placeName: string) => void;
  onClearSearch?: () => void;
}

export function MapFilters({ filters, onFiltersChange, onLocationSelect, onClearSearch }: MapFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [techOpen, setTechOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const { data: technicians } = useTechnicians();

  const activeFilterCount = countActiveFilters(filters);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      onFiltersChange({ ...filters, startDate: date });
    }
  };

  const handleWeekViewChange = (checked: boolean) => {
    onFiltersChange({ ...filters, weekView: checked });
  };

  const handleShowZonesChange = (checked: boolean) => {
    onFiltersChange({ ...filters, showZones: checked });
  };

  const handleShowTechLocationsChange = (checked: boolean) => {
    onFiltersChange({ ...filters, showTechLocations: checked });
  };

  const toggleTechnician = (id: string) => {
    let newTechs: string[];
    
    if (id === 'all') {
      newTechs = ['all'];
    } else {
      const current = filters.technicians.filter(t => t !== 'all');
      if (current.includes(id)) {
        newTechs = current.filter(t => t !== id);
        if (newTechs.length === 0) newTechs = ['all'];
      } else {
        newTechs = [...current, id];
      }
    }
    
    onFiltersChange({ ...filters, technicians: newTechs });
  };


  const toggleStatus = (status: string) => {
    let newStatuses: string[];
    
    if (status === 'all') {
      newStatuses = ['all'];
    } else {
      const current = filters.statuses.filter(s => s !== 'all');
      if (current.includes(status)) {
        newStatuses = current.filter(s => s !== status);
        if (newStatuses.length === 0) newStatuses = ['all'];
      } else {
        newStatuses = [...current, status];
      }
    }
    
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const clearFilters = () => {
    onFiltersChange({
      ...DEFAULT_FILTERS,
      startDate: filters.startDate, // Keep the date
      showZones: filters.showZones, // Keep zones toggle
      showTechLocations: filters.showTechLocations, // Keep tech locations toggle
    });
  };

  const dateLabel = filters.weekView
    ? `${format(filters.startDate, "MMM d")} - ${format(addDays(filters.startDate, 6), "MMM d")}`
    : format(filters.startDate, "PPP");

  return (
    <Card className="absolute top-4 left-4 z-10 w-80 shadow-lg max-h-[80vh] overflow-hidden flex flex-col">
      <CardContent className="p-3 flex flex-col overflow-hidden">
        {/* Address Search */}
        {onLocationSelect && (
          <div className="mb-3">
            <AddressSearch 
              onLocationSelect={onLocationSelect}
              onClear={onClearSearch}
            />
          </div>
        )}
        
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
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
        </div>

        {isExpanded && (
          <ScrollArea className="mt-3 -mr-3 pr-3">
            <div className="space-y-3">
              {/* Date Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Date Range
                  </Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="week-view" className="text-xs text-muted-foreground">
                      Week
                    </Label>
                    <Switch
                      id="week-view"
                      checked={filters.weekView}
                      onCheckedChange={handleWeekViewChange}
                      className="scale-75"
                    />
                  </div>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-sm",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={handleDateChange}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Separator />

              {/* Technician Filter */}
              <Collapsible open={techOpen} onOpenChange={setTechOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                    <User className="h-3.5 w-3.5" />
                    Technicians
                    {!filters.technicians.includes('all') && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {filters.technicians.length}
                      </Badge>
                    )}
                  </Label>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    techOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tech-all"
                      checked={filters.technicians.includes('all')}
                      onCheckedChange={() => toggleTechnician('all')}
                    />
                    <Label htmlFor="tech-all" className="text-xs cursor-pointer">All Technicians</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tech-unassigned"
                      checked={filters.technicians.includes('unassigned')}
                      onCheckedChange={() => toggleTechnician('unassigned')}
                    />
                    <Label htmlFor="tech-unassigned" className="text-xs cursor-pointer text-muted-foreground">
                      Unassigned
                    </Label>
                  </div>
                  {technicians?.map((tech) => (
                    <div key={tech.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tech-${tech.id}`}
                        checked={filters.technicians.includes(tech.id)}
                        onCheckedChange={() => toggleTechnician(tech.id)}
                      />
                      <Label htmlFor={`tech-${tech.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                        {tech.name}
                        {tech.isLinked && (
                          <span className="text-[10px] text-muted-foreground">(linked)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Status Filter */}
              <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                    <CircleDot className="h-3.5 w-3.5" />
                    Status
                    {!filters.statuses.includes('all') && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {filters.statuses.length}
                      </Badge>
                    )}
                  </Label>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    statusOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="status-all"
                      checked={filters.statuses.includes('all')}
                      onCheckedChange={() => toggleStatus('all')}
                    />
                    <Label htmlFor="status-all" className="text-xs cursor-pointer">All Statuses</Label>
                  </div>
                  {JOB_STATUSES.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                      />
                      <Label htmlFor={`status-${status.value}`} className="text-xs cursor-pointer">
                        {status.label}
                      </Label>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Show Zones Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-zones" className="text-xs cursor-pointer">
                  Show Service Zones
                </Label>
                <Switch
                  id="show-zones"
                  checked={filters.showZones}
                  onCheckedChange={handleShowZonesChange}
                  className="scale-75"
                />
              </div>

              {/* Show Tech Locations Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-tech-locs" className="text-xs cursor-pointer flex items-center gap-1.5">
                  <Home className="h-3 w-3" />
                  Tech Home Locations
                </Label>
                <Switch
                  id="show-tech-locs"
                  checked={filters.showTechLocations}
                  onCheckedChange={handleShowTechLocationsChange}
                  className="scale-75"
                />
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
