import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { useJobsForDate, useServiceZones, useFirstLocation, HCPJob } from "@/hooks/useJobMap";

// Get Mapbox token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Default center (US center) if no location data
const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 4;

// Status colors for markers
const STATUS_COLORS: Record<string, string> = {
  scheduled: "#6366f1", // primary indigo
  in_progress: "#3b82f6", // blue
  completed: "#22c55e", // green
  cancelled: "#ef4444", // red
};

// Default zone colors
const DEFAULT_ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

function getStatusColor(status: string | null): string {
  if (!status) return STATUS_COLORS.scheduled;
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  return STATUS_COLORS[normalized] || STATUS_COLORS.scheduled;
}

function formatTime(time: string | null): string {
  if (!time) return '';
  // Parse time like "09:00:00" or "9:00"
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function createPopupContent(job: HCPJob): string {
  const services = job.services as { name?: string }[] | null;
  const serviceList = services?.map(s => s.name).filter(Boolean).join(', ') || 'N/A';
  
  return `
    <div style="min-width: 200px; font-family: system-ui, sans-serif;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">
        ${job.customer_name || 'Unknown Customer'}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
        ${[job.address, job.city, job.state].filter(Boolean).join(', ')}
      </div>
      <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px;">
        <div>
          <div style="color: #64748b;">Time</div>
          <div style="font-weight: 500;">${formatTime(job.scheduled_time) || 'TBD'}</div>
        </div>
        <div>
          <div style="color: #64748b;">Status</div>
          <div style="font-weight: 500; text-transform: capitalize;">${job.status || 'Scheduled'}</div>
        </div>
      </div>
      <div style="margin-top: 8px; font-size: 12px;">
        <div style="color: #64748b;">Services</div>
        <div style="font-weight: 500;">${serviceList}</div>
      </div>
      ${job.technician_name ? `
        <div style="margin-top: 8px; font-size: 12px;">
          <div style="color: #64748b;">Technician</div>
          <div style="font-weight: 500;">${job.technician_name}</div>
        </div>
      ` : ''}
    </div>
  `;
}

export function JobMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [mapLoaded, setMapLoaded] = useState(false);

  const { data: jobs, isLoading: jobsLoading } = useJobsForDate(
    selectedDate,
    technicianFilter,
    serviceFilter
  );
  const { data: zones } = useServiceZones();
  const { data: firstLocation } = useFirstLocation();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) {
      console.error("Mapbox token not configured");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map center based on first location or first job
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // If we have jobs with coordinates, center on the first one
    const jobsWithCoords = jobs?.filter(j => j.lat && j.lng) || [];
    if (jobsWithCoords.length > 0) {
      const firstJob = jobsWithCoords[0];
      map.current.flyTo({
        center: [firstJob.lng!, firstJob.lat!],
        zoom: 10,
        duration: 1000,
      });
    }
  }, [jobs, mapLoaded]);

  // Add service zone polygons
  useEffect(() => {
    if (!map.current || !mapLoaded || !zones) return;

    // Remove existing zone layers
    zones.forEach((zone, idx) => {
      const sourceId = `zone-${zone.id}`;
      if (map.current?.getSource(sourceId)) {
        if (map.current.getLayer(`${sourceId}-fill`)) {
          map.current.removeLayer(`${sourceId}-fill`);
        }
        if (map.current.getLayer(`${sourceId}-line`)) {
          map.current.removeLayer(`${sourceId}-line`);
        }
        map.current.removeSource(sourceId);
      }
    });

    // Add zone polygons
    zones.forEach((zone, idx) => {
      if (!zone.polygon_geojson) return;

      const sourceId = `zone-${zone.id}`;
      const color = zone.color || DEFAULT_ZONE_COLORS[idx % DEFAULT_ZONE_COLORS.length];

      map.current!.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: zone.name },
          geometry: zone.polygon_geojson,
        },
      });

      map.current!.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": color,
          "fill-opacity": 0.15,
        },
      });

      map.current!.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": 2,
        },
      });
    });
  }, [zones, mapLoaded]);

  // Add job markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    popupsRef.current.forEach(popup => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    if (!jobs) return;

    // Add markers for jobs with coordinates
    jobs.forEach((job) => {
      if (!job.lat || !job.lng) return;

      const color = getStatusColor(job.status);

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "job-marker";
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.15s ease;
      `;

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const popup = new mapboxgl.Popup({
        offset: 15,
        closeButton: true,
        closeOnClick: false,
        maxWidth: "280px",
      }).setHTML(createPopupContent(job));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.lng, job.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [jobs, mapLoaded]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50">
        <div className="text-center">
          <p className="text-lg font-medium">Mapbox Token Required</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please configure VITE_MAPBOX_TOKEN to display the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      
      <MapFilters
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        technicianFilter={technicianFilter}
        onTechnicianChange={setTechnicianFilter}
        serviceFilter={serviceFilter}
        onServiceChange={setServiceFilter}
      />

      <MapLegend zones={zones || []} jobCount={jobs?.length || 0} />

      {jobsLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background/80 rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading jobs...</span>
          </div>
        </div>
      )}
    </div>
  );
}
