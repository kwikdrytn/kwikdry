import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ServiceZone } from "@/hooks/useJobMap";

interface MapLegendProps {
  zones: ServiceZone[];
  jobCount: number;
}

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  scheduled: { color: "hsl(var(--primary))", label: "Scheduled" },
  in_progress: { color: "hsl(217, 91%, 60%)", label: "In Progress" },
  completed: { color: "hsl(142, 71%, 45%)", label: "Completed" },
  cancelled: { color: "hsl(0, 84%, 60%)", label: "Cancelled" },
};

export function MapLegend({ zones, jobCount }: MapLegendProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const zonesWithBoundaries = zones.filter(z => z.polygon_geojson);

  return (
    <Card className="absolute bottom-4 left-4 z-10 w-56 shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4" />
            Legend
            <span className="text-xs text-muted-foreground">({jobCount} jobs)</span>
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
            {/* Job Status */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Status</p>
              <div className="space-y-1">
                {Object.entries(STATUS_COLORS).map(([status, { color, label }]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Zones */}
            {zonesWithBoundaries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Service Zones</p>
                <div className="space-y-1">
                  {zonesWithBoundaries.map((zone) => (
                    <div key={zone.id} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded border border-border"
                        style={{ 
                          backgroundColor: zone.color ? `${zone.color}40` : 'hsl(var(--muted))',
                          borderColor: zone.color || 'hsl(var(--border))'
                        }}
                      />
                      <span className="text-xs truncate">{zone.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
