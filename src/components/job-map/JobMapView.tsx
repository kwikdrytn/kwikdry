import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { AddressSearch } from "./AddressSearch";
import { 
  useJobsForDateRange, 
  useServiceZones, 
  useFirstLocation,
  HCPJob, 
  ServiceZone,
  MapFilters as MapFiltersType,
  DEFAULT_FILTERS,
  DAY_COLORS,
  filtersToSearchParams,
  searchParamsToFilters
} from "@/hooks/useJobMap";

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
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatTimeRange(startTime: string | null, endTime: string | null): string {
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return 'TBD';
}

function createHoverContent(job: HCPJob, isWeekView: boolean): string {
  const dateStr = job.scheduled_date ? format(parseISO(job.scheduled_date), 'EEE, MMM d') : '';
  const timeRange = formatTimeRange(job.scheduled_time, job.scheduled_end);
  
  return `
    <div style="min-width: 220px; font-family: system-ui, sans-serif; padding: 4px;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #0f172a;">
        ${job.customer_name || 'Unknown Customer'}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
        ${[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
        ${isWeekView ? `
          <div>
            <div style="color: #94a3b8; font-size: 11px;">Date</div>
            <div style="font-weight: 500; color: #1e293b;">${dateStr}</div>
          </div>
        ` : ''}
        <div>
          <div style="color: #94a3b8; font-size: 11px;">Time</div>
          <div style="font-weight: 500; color: #1e293b;">${timeRange}</div>
        </div>
        <div>
          <div style="color: #94a3b8; font-size: 11px;">Technician</div>
          <div style="font-weight: 500; color: #1e293b;">${job.technician_name || 'Unassigned'}</div>
        </div>
        <div>
          <div style="color: #94a3b8; font-size: 11px;">Status</div>
          <div style="font-weight: 500; color: #1e293b; text-transform: capitalize;">${job.status || 'Scheduled'}</div>
        </div>
      </div>
    </div>
  `;
}

// Calculate polygon centroid for label placement
function getPolygonCentroid(coordinates: number[][]): [number, number] {
  let x = 0, y = 0, area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n - 1; i++) {
    const x0 = coordinates[i][0];
    const y0 = coordinates[i][1];
    const x1 = coordinates[i + 1][0];
    const y1 = coordinates[i + 1][1];
    
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    x += (x0 + x1) * cross;
    y += (y0 + y1) * cross;
  }
  
  area /= 2;
  if (area === 0) {
    const avgX = coordinates.reduce((sum, c) => sum + c[0], 0) / n;
    const avgY = coordinates.reduce((sum, c) => sum + c[1], 0) / n;
    return [avgX, avgY];
  }
  
  x /= (6 * area);
  y /= (6 * area);
  
  return [x, y];
}

// Calculate bounding box for zoom
function getPolygonBounds(coordinates: number[][]): [[number, number], [number, number]] {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  coordinates.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  
  return [[minLng, minLat], [maxLng, maxLat]];
}

// Get marker color based on view mode
function getMarkerColor(job: HCPJob, isWeekView: boolean, startDate: Date): string {
  if (isWeekView && job.scheduled_date) {
    const jobDate = parseISO(job.scheduled_date);
    const dayOfWeek = jobDate.getDay();
    return DAY_COLORS[dayOfWeek];
  }
  return getStatusColor(job.status);
}

export function JobMapView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const zonePopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredZoneRef = useRef<string | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const initialFiltersApplied = useRef(false);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<MapFiltersType>(() => {
    const urlFilters = searchParamsToFilters(searchParams);
    return { ...DEFAULT_FILTERS, ...urlFilters };
  });
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<{ coords: [number, number]; name: string } | null>(null);

  // Update URL when filters change
  useEffect(() => {
    if (!initialFiltersApplied.current) {
      initialFiltersApplied.current = true;
      return;
    }
    const newParams = filtersToSearchParams(filters);
    setSearchParams(newParams, { replace: true });
  }, [filters, setSearchParams]);

  const { data: jobs, isLoading: jobsLoading } = useJobsForDateRange(filters);
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

  // Update map center based on first job
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

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

  // Add service zone polygons with labels and hover
  useEffect(() => {
    if (!map.current || !mapLoaded || !zones) return;

    const currentMap = map.current;

    // Remove existing zone layers and sources
    zones.forEach((zone) => {
      const sourceId = `zone-${zone.id}`;
      const labelSourceId = `zone-label-${zone.id}`;
      
      [`${sourceId}-fill`, `${sourceId}-line`, `${sourceId}-highlight`, `${labelSourceId}-label`].forEach(layerId => {
        if (currentMap.getLayer(layerId)) {
          currentMap.removeLayer(layerId);
        }
      });
      
      if (currentMap.getSource(sourceId)) {
        currentMap.removeSource(sourceId);
      }
      if (currentMap.getSource(labelSourceId)) {
        currentMap.removeSource(labelSourceId);
      }
    });

    // Add zone polygons
    zones.forEach((zone, idx) => {
      if (!zone.polygon_geojson?.coordinates?.[0]) return;

      const sourceId = `zone-${zone.id}`;
      const labelSourceId = `zone-label-${zone.id}`;
      const color = zone.color || DEFAULT_ZONE_COLORS[idx % DEFAULT_ZONE_COLORS.length];
      const centroid = getPolygonCentroid(zone.polygon_geojson.coordinates[0]);

      // Add polygon source
      currentMap.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: zone.name, id: zone.id, color },
          geometry: zone.polygon_geojson,
        },
      });

      // Add label source (point at centroid)
      currentMap.addSource(labelSourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: zone.name },
          geometry: {
            type: "Point",
            coordinates: centroid,
          },
        },
      });

      // Fill layer (20% opacity)
      currentMap.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": color,
          "fill-opacity": 0.2,
        },
        layout: {
          visibility: filters.showZones ? "visible" : "none",
        },
      });

      // Highlight layer (hidden by default, shown on hover)
      currentMap.addLayer({
        id: `${sourceId}-highlight`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": color,
          "fill-opacity": 0.4,
        },
        layout: {
          visibility: "none",
        },
      });

      // Border line layer
      currentMap.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": 2,
        },
        layout: {
          visibility: filters.showZones ? "visible" : "none",
        },
      });

      // Zone name label
      currentMap.addLayer({
        id: `${labelSourceId}-label`,
        type: "symbol",
        source: labelSourceId,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          visibility: filters.showZones ? "visible" : "none",
        },
        paint: {
          "text-color": color,
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      // Add hover events for fill layer (highlight only, no popup)
      currentMap.on("mouseenter", `${sourceId}-fill`, () => {
        if (!filters.showZones) return;
        
        currentMap.getCanvas().style.cursor = "pointer";
        hoveredZoneRef.current = zone.id;
        
        currentMap.setLayoutProperty(`${sourceId}-highlight`, "visibility", "visible");
      });

      currentMap.on("mouseleave", `${sourceId}-fill`, () => {
        currentMap.getCanvas().style.cursor = "";
        hoveredZoneRef.current = null;
        
        if (currentMap.getLayer(`${sourceId}-highlight`)) {
          currentMap.setLayoutProperty(`${sourceId}-highlight`, "visibility", "none");
        }
      });
    });
  }, [zones, mapLoaded, filters.showZones]);

  // Toggle zone visibility
  useEffect(() => {
    if (!map.current || !mapLoaded || !zones) return;

    zones.forEach((zone) => {
      const sourceId = `zone-${zone.id}`;
      const labelSourceId = `zone-label-${zone.id}`;
      const visibility = filters.showZones ? "visible" : "none";

      if (map.current?.getLayer(`${sourceId}-fill`)) {
        map.current.setLayoutProperty(`${sourceId}-fill`, "visibility", visibility);
      }
      if (map.current?.getLayer(`${sourceId}-line`)) {
        map.current.setLayoutProperty(`${sourceId}-line`, "visibility", visibility);
      }
      if (map.current?.getLayer(`${labelSourceId}-label`)) {
        map.current.setLayoutProperty(`${labelSourceId}-label`, "visibility", visibility);
      }
      if (map.current?.getLayer(`${sourceId}-highlight`)) {
        map.current.setLayoutProperty(`${sourceId}-highlight`, "visibility", "none");
      }
    });
  }, [filters.showZones, zones, mapLoaded]);

  // Add job markers with hover popups
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

      const color = getMarkerColor(job, filters.weekView, filters.startDate);

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

      // Create popup for hover
      const popup = new mapboxgl.Popup({
        offset: 15,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "300px",
        className: "job-hover-popup",
      }).setHTML(createHoverContent(job, filters.weekView));

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
        popup.addTo(map.current!);
      });
      
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        popup.remove();
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.lng, job.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [jobs, mapLoaded, filters.weekView, filters.startDate]);

  // Handle address search location
  const handleLocationSelect = useCallback((coords: [number, number], placeName: string) => {
    if (!map.current) return;

    // Remove existing search marker
    searchMarkerRef.current?.remove();

    // Create a custom pin marker for the searched location
    const el = document.createElement("div");
    el.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.164 0 0 7.164 0 16c0 10.487 14.4 23.1 15.025 23.663a1.5 1.5 0 0 0 1.95 0C17.6 39.1 32 26.487 32 16c0-8.836-7.164-16-16-16z" fill="#dc2626"/>
        <circle cx="16" cy="16" r="8" fill="white"/>
      </svg>
    `;
    el.style.cssText = "cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));";

    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
      closeOnClick: false,
    }).setHTML(`
      <div style="font-family: system-ui, sans-serif; padding: 4px;">
        <div style="font-weight: 600; font-size: 12px; color: #dc2626; margin-bottom: 2px;">Searched Location</div>
        <div style="font-size: 12px; color: #374151;">${placeName}</div>
      </div>
    `);

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map.current);

    // Show popup on hover
    el.addEventListener("mouseenter", () => popup.setLngLat(coords).addTo(map.current!));
    el.addEventListener("mouseleave", () => popup.remove());

    searchMarkerRef.current = marker;
    setSearchedLocation({ coords, name: placeName });

    // Fly to location
    map.current.flyTo({
      center: coords,
      zoom: 14,
      duration: 1500,
    });
  }, []);

  const handleClearSearch = useCallback(() => {
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
    setSearchedLocation(null);
  }, []);

  // Handle zone click from legend
  const handleZoneClick = useCallback((zone: ServiceZone) => {
    if (!map.current || !zone.polygon_geojson?.coordinates?.[0]) return;

    const bounds = getPolygonBounds(zone.polygon_geojson.coordinates[0]);
    
    map.current.fitBounds(bounds, {
      padding: 50,
      duration: 1000,
    });
  }, []);

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
      
      {/* Address Search */}
      <div className="absolute top-4 left-4 w-80 z-10">
        <AddressSearch 
          onLocationSelect={handleLocationSelect}
          onClear={handleClearSearch}
        />
      </div>
      
      <MapFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      <MapLegend 
        zones={zones || []} 
        jobs={jobs || []}
        filters={filters}
        onZoneClick={handleZoneClick}
      />

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
