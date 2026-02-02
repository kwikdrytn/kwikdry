import { useState, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ChevronDown, ChevronUp, Layers, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServiceZone, HCPJob, MapFilters as MapFiltersType, DAY_COLORS, JOB_STATUSES } from "@/hooks/useJobMap";

interface MapLegendProps {
  zones: ServiceZone[];
  jobs: HCPJob[];
  filters: MapFiltersType;
  onZoneClick: (zone: ServiceZone) => void;
}

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  scheduled: { color: "#6366f1", label: "Scheduled" },
  in_progress: { color: "#3b82f6", label: "In Progress" },
  completed: { color: "#22c55e", label: "Completed" },
  cancelled: { color: "#ef4444", label: "Cancelled" },
};

// Default zone colors
const DEFAULT_ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Check if a point is inside a polygon using ray casting algorithm
function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

export function MapLegend({ zones, jobs, filters, onZoneClick }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const zonesWithBoundaries = zones.filter(z => z.polygon_geojson);

  // Calculate job counts per zone
  const jobCountsByZone = useMemo(() => {
    const counts = new Map<string, number>();
    
    zonesWithBoundaries.forEach(zone => {
      if (!zone.polygon_geojson?.coordinates?.[0]) {
        counts.set(zone.id, 0);
        return;
      }
      
      const polygon = zone.polygon_geojson.coordinates[0];
      let count = 0;
      
      jobs.forEach(job => {
        if (job.lng && job.lat) {
          if (isPointInPolygon([job.lng, job.lat], polygon)) {
            count++;
          }
        }
      });
      
      counts.set(zone.id, count);
    });
    
    return counts;
  }, [zonesWithBoundaries, jobs]);

  // Get unique days from jobs for week view legend
  const jobsByDay = useMemo(() => {
    if (!filters.weekView) return null;
    
    const dayMap = new Map<number, number>();
    jobs.forEach(job => {
      if (job.scheduled_date) {
        const date = parseISO(job.scheduled_date);
        const dayOfWeek = date.getDay();
        dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) || 0) + 1);
      }
    });
    
    return dayMap;
  }, [jobs, filters.weekView]);

  return (
    <Card className="absolute top-4 right-14 z-10 w-60 shadow-lg max-h-[50vh] overflow-hidden flex flex-col">
      <CardContent className="p-3 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4" />
            Legend
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {jobs.length} jobs
            </Badge>
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
          <ScrollArea className="mt-3 -mr-3 pr-3">
            <div className="space-y-3">
              {/* Week View - Days */}
              {filters.weekView && jobsByDay && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Days (Week View)
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {WEEKDAY_LABELS.map((label, idx) => {
                      const count = jobsByDay.get(idx) || 0;
                      return (
                        <div key={label} className="flex items-center gap-1.5">
                          <div
                            className="h-3 w-3 rounded-full border border-white flex-shrink-0"
                            style={{ 
                              backgroundColor: DAY_COLORS[idx],
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }}
                          />
                          <span className="text-xs">{label}</span>
                          {count > 0 && (
                            <span className="text-[10px] text-muted-foreground">({count})</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Job Status - Only show when not in week view */}
              {!filters.weekView && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Status</p>
                  <div className="space-y-1">
                    {Object.entries(STATUS_COLORS).map(([status, { color, label }]) => (
                      <div key={status} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full border border-white flex-shrink-0"
                          style={{ 
                            backgroundColor: color,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                          }}
                        />
                        <span className="text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Zones */}
              {filters.showZones && zonesWithBoundaries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Service Zones
                  </p>
                  <div className="space-y-1">
                    {zonesWithBoundaries.map((zone, idx) => {
                      const color = zone.color || DEFAULT_ZONE_COLORS[idx % DEFAULT_ZONE_COLORS.length];
                      const jobCount = jobCountsByZone.get(zone.id) || 0;
                      
                      return (
                        <button
                          key={zone.id}
                          onClick={() => onZoneClick(zone)}
                          className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors group"
                        >
                          <div
                            className="h-3 w-3 rounded border flex-shrink-0"
                            style={{ 
                              backgroundColor: `${color}33`,
                              borderColor: color
                            }}
                          />
                          <span className="text-xs truncate flex-1 group-hover:text-primary">
                            {zone.name}
                          </span>
                          {jobCount > 0 && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
                            >
                              <MapPin className="h-2.5 w-2.5 mr-0.5" />
                              {jobCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!filters.showZones && zonesWithBoundaries.length > 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Enable "Show Zones" to view service areas
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
