import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Layers, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceZone, HCPJob } from "@/hooks/useJobMap";

interface MapLegendProps {
  zones: ServiceZone[];
  jobs: HCPJob[];
  showZones: boolean;
  onZoneClick: (zone: ServiceZone) => void;
}

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  scheduled: { color: "hsl(var(--primary))", label: "Scheduled" },
  in_progress: { color: "hsl(217, 91%, 60%)", label: "In Progress" },
  completed: { color: "hsl(142, 71%, 45%)", label: "Completed" },
  cancelled: { color: "hsl(0, 84%, 60%)", label: "Cancelled" },
};

// Default zone colors for consistent display
const DEFAULT_ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

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

export function MapLegend({ zones, jobs, showZones, onZoneClick }: MapLegendProps) {
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

  return (
    <Card className="absolute bottom-4 left-4 z-10 w-60 shadow-lg max-h-[50vh] overflow-hidden flex flex-col">
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
          <div className="mt-3 space-y-3 overflow-y-auto">
            {/* Job Status */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Status</p>
              <div className="space-y-1">
                {Object.entries(STATUS_COLORS).map(([status, { color, label }]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Zones */}
            {showZones && zonesWithBoundaries.length > 0 && (
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

            {!showZones && zonesWithBoundaries.length > 0 && (
              <p className="text-xs text-muted-foreground italic">
                Enable "Show Zones" to view service areas
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
