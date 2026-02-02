import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { AddressSearch } from "./AddressSearch";
import { BookingSuggestionPanel } from "./BookingSuggestionPanel";
import { 
  useJobsForDateRange, 
  useServiceZones, 
  useFirstLocation,
  useTechnicianLocations,
  HCPJob, 
  ServiceZone,
  TechnicianLocation,
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

function createClickContent(
  job: HCPJob, 
  isWeekView: boolean, 
  drivingInfo?: { duration: string; distance: string } | null,
  fromAddress?: string
): string {
  const dateStr = job.scheduled_date ? format(parseISO(job.scheduled_date), 'EEE, MMM d') : '';
  const timeRange = formatTimeRange(job.scheduled_time, job.scheduled_end);
  
  // Prefer total_items, fall back to services
  const services = (job.total_items || job.services) as { name?: string; description?: string; price?: number; quantity?: number }[] | null;
  
  // Build services list with details
  let servicesHtml = '';
  if (services && services.length > 0) {
    const serviceItems = services.map(s => {
      const name = s.name || 'Unknown Service';
      const details: string[] = [];
      if (s.quantity && s.quantity > 1) details.push(`×${s.quantity}`);
      // Price is stored in cents, convert to dollars
      if (s.price) details.push(`$${(s.price / 100).toFixed(2)}`);
      return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
        <span style="font-weight: 500; color: #1e293b;">${name}</span>
        ${details.length > 0 ? `<span style="font-size: 11px; color: #64748b;">${details.join(' • ')}</span>` : ''}
      </div>`;
    }).join('');
    servicesHtml = `
      <div style="margin-top: 10px; font-size: 12px;">
        <div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Services</div>
        <div style="background: #f8fafc; border-radius: 6px; padding: 6px 8px;">
          ${serviceItems}
        </div>
      </div>
    `;
  } else {
    servicesHtml = `
      <div style="margin-top: 10px; font-size: 12px;">
        <div style="color: #94a3b8; font-size: 11px;">Services</div>
        <div style="font-weight: 500; color: #64748b; font-style: italic;">No services listed</div>
      </div>
    `;
  }
  
  // Build notes section - handle both string and array formats (may be JSON string)
  let notesHtml = '';
  if (job.notes) {
    let notesContent = '';
    let notesData = job.notes;
    
    // Try to parse if it's a JSON string
    if (typeof notesData === 'string' && notesData.trim().startsWith('[')) {
      try {
        notesData = JSON.parse(notesData);
      } catch {
        // Keep as string if parsing fails
      }
    }
    
    if (Array.isArray(notesData)) {
      // Notes is an array of {id, content} objects
      const noteContents = notesData
        .filter((n: { id?: string; content?: string }) => n.content)
        .map((n: { id?: string; content?: string }) => n.content)
        .join('\n');
      notesContent = noteContents;
    } else if (typeof notesData === 'string') {
      // Notes is a plain string
      notesContent = notesData;
    }
    
    if (notesContent) {
      const truncatedNotes = notesContent.length > 200 ? notesContent.substring(0, 200) + '...' : notesContent;
      notesHtml = `
        <div style="margin-top: 10px; font-size: 12px;">
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Notes</div>
          <div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 10px; border-radius: 0 6px 6px 0; color: #78350f; font-size: 11px; line-height: 1.4;">
            ${truncatedNotes.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    }
  }
  
  return `
    <div style="min-width: 280px; max-width: 360px; font-family: system-ui, sans-serif; max-height: 400px; overflow-y: auto;">
      <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px; color: #0f172a;">
        ${job.customer_name || 'Unknown Customer'}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 10px;">
        ${[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}
      </div>
      
      ${drivingInfo ? `
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 8px; padding: 10px; margin-bottom: 10px; color: white;">
          <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Driving from ${fromAddress || 'searched location'}</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 20px; font-weight: 700;">${drivingInfo.duration}</div>
              <div style="font-size: 11px; opacity: 0.8;">drive time</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 600;">${drivingInfo.distance}</div>
              <div style="font-size: 11px; opacity: 0.8;">distance</div>
            </div>
          </div>
        </div>
      ` : fromAddress === undefined ? '' : `
        <div style="background: #f1f5f9; border-radius: 8px; padding: 10px; margin-bottom: 10px; text-align: center;">
          <div style="font-size: 12px; color: #64748b;">
            Search an address to see driving time
          </div>
        </div>
      `}
      
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
        ${job.total_amount ? `
          <div>
            <div style="color: #94a3b8; font-size: 11px;">Total</div>
            <div style="font-weight: 600; color: #059669;">$${(job.total_amount / 100).toFixed(2)}</div>
          </div>
        ` : ''}
      </div>
      ${servicesHtml}
      ${notesHtml}
    </div>
  `;
}

async function fetchDrivingDirections(
  from: [number, number], 
  to: [number, number]
): Promise<{ duration: string; distance: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?access_token=${MAPBOX_TOKEN}&overview=false`
    );
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const durationMins = Math.round(route.duration / 60);
      const distanceMiles = (route.distance / 1609.34).toFixed(1);
      
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
      
      return {
        duration: durationStr,
        distance: `${distanceMiles} mi`,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching directions:', error);
    return null;
  }
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
  const techMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const zonePopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredZoneRef = useRef<string | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const searchedLocationRef = useRef<{ coords: [number, number]; name: string } | null>(null);
  const clickPopupRef = useRef<mapboxgl.Popup | null>(null);
  const initialFiltersApplied = useRef(false);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<MapFiltersType>(() => {
    const urlFilters = searchParamsToFilters(searchParams);
    return { ...DEFAULT_FILTERS, ...urlFilters };
  });
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<{ coords: [number, number]; name: string } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [legendExpanded, setLegendExpanded] = useState(true);
  
  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    searchedLocationRef.current = searchedLocation;
  }, [searchedLocation]);

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
  const { data: technicianLocations } = useTechnicianLocations();

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

    // Close click popup when clicking on the map (outside markers)
    map.current.on("click", () => {
      clickPopupRef.current?.remove();
      clickPopupRef.current = null;
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Fit map to service zones on initial load
  const hasInitiallyFit = useRef(false);
  
  useEffect(() => {
    if (!map.current || !mapLoaded || hasInitiallyFit.current) return;
    if (!map.current.isStyleLoaded()) return;

    // Priority 1: Fit to all service zones
    if (zones && zones.length > 0) {
      const zonesWithPolygons = zones.filter(z => z.polygon_geojson?.coordinates?.[0]);
      
      if (zonesWithPolygons.length > 0) {
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;

        zonesWithPolygons.forEach(zone => {
          const coords = zone.polygon_geojson!.coordinates[0];
          coords.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          });
        });

        if (minLng !== Infinity) {
          map.current.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 50, duration: 1000 }
          );
          hasInitiallyFit.current = true;
          return;
        }
      }
    }

    // Priority 2: Fit to jobs if no zones
    const jobsWithCoords = jobs?.filter(j => j.lat && j.lng) || [];
    if (jobsWithCoords.length > 0) {
      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;

      jobsWithCoords.forEach(job => {
        if (job.lng! < minLng) minLng = job.lng!;
        if (job.lng! > maxLng) maxLng = job.lng!;
        if (job.lat! < minLat) minLat = job.lat!;
        if (job.lat! > maxLat) maxLat = job.lat!;
      });

      if (jobsWithCoords.length === 1) {
        map.current.flyTo({
          center: [jobsWithCoords[0].lng!, jobsWithCoords[0].lat!],
          zoom: 12,
          duration: 1000,
        });
      } else {
        map.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 50, duration: 1000 }
        );
      }
      hasInitiallyFit.current = true;
    }
  }, [zones, jobs, mapLoaded]);

  // Add service zone polygons with labels and hover
  useEffect(() => {
    if (!map.current || !mapLoaded || !zones) return;
    
    const currentMap = map.current;
    
    // Ensure style is fully loaded before adding sources/layers
    if (!currentMap.isStyleLoaded()) {
      const handleStyleLoad = () => {
        // Trigger re-render to run this effect again
        setMapLoaded(prev => prev);
      };
      currentMap.once('idle', handleStyleLoad);
      return;
    }

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
    if (!map.current.isStyleLoaded()) return;

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
    if (!map.current.isStyleLoaded()) return;

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
      const hoverPopup = new mapboxgl.Popup({
        offset: 15,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "300px",
        className: "job-hover-popup",
      }).setHTML(createHoverContent(job, filters.weekView));

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
        // Only show hover popup if click popup is not open
        if (!clickPopupRef.current?.isOpen()) {
          hoverPopup.addTo(map.current!);
        }
      });
      
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        hoverPopup.remove();
      });

      // Click handler for driving directions
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        hoverPopup.remove();
        
        // Close any existing click popup
        clickPopupRef.current?.remove();
        
        const searchLoc = searchedLocationRef.current;
        
        // Show loading state
        const loadingPopup = new mapboxgl.Popup({
          offset: 15,
          closeButton: false,
          closeOnClick: false,
          maxWidth: "340px",
          className: "job-click-popup",
        })
          .setLngLat([job.lng!, job.lat!])
          .setHTML(searchLoc 
            ? createClickContent(job, filters.weekView, undefined, searchLoc.name) 
              .replace('</div></div></div>', '<div style="text-align: center; padding: 10px; color: #64748b;">Calculating route...</div></div></div></div>')
            : createClickContent(job, filters.weekView, null, '')
          )
          .addTo(map.current!);
        
        clickPopupRef.current = loadingPopup;
        
        if (searchLoc) {
          // Fetch driving directions
          const drivingInfo = await fetchDrivingDirections(
            searchLoc.coords,
            [job.lng!, job.lat!]
          );
          
          // Update popup with driving info
          if (clickPopupRef.current === loadingPopup && loadingPopup.isOpen()) {
            loadingPopup.setHTML(createClickContent(job, filters.weekView, drivingInfo, searchLoc.name));
          }
        }
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([job.lng, job.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(hoverPopup);
    });
  }, [jobs, mapLoaded, filters.weekView, filters.startDate]);

  // Add technician home location markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.isStyleLoaded()) return;

    // Clear existing tech markers
    techMarkersRef.current.forEach(marker => marker.remove());
    techMarkersRef.current = [];

    // Don't show if toggle is off
    if (!filters.showTechLocations) return;
    if (!technicianLocations) return;

    // Add markers for technician home locations
    technicianLocations.forEach((tech) => {
      const el = document.createElement("div");
      el.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="12" fill="#059669" stroke="white" stroke-width="2"/>
          <path d="M14 8L8 13V19H11V15H17V19H20V13L14 8Z" fill="white"/>
        </svg>
      `;
      el.style.cssText = "cursor: pointer; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));";

      const popup = new mapboxgl.Popup({
        offset: 15,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "250px",
      }).setHTML(`
        <div style="font-family: system-ui, sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <div style="width: 8px; height: 8px; background: #059669; border-radius: 50%;"></div>
            <span style="font-weight: 600; font-size: 13px; color: #0f172a;">Tech Home</span>
          </div>
          <div style="font-weight: 500; font-size: 13px; color: #1e293b; margin-bottom: 2px;">${tech.name}</div>
          <div style="font-size: 11px; color: #64748b;">${tech.address || 'Address not available'}</div>
        </div>
      `);

      el.addEventListener("mouseenter", () => {
        popup.setLngLat([tech.lng, tech.lat]).addTo(map.current!);
      });
      el.addEventListener("mouseleave", () => {
        popup.remove();
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([tech.lng, tech.lat])
        .addTo(map.current!);

      techMarkersRef.current.push(marker);
    });
  }, [technicianLocations, mapLoaded, filters.showTechLocations]);

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
      
      <MapFilters
        filters={filters}
        onFiltersChange={setFilters}
        onLocationSelect={handleLocationSelect}
        onClearSearch={handleClearSearch}
        isExpanded={filtersExpanded}
        onExpandedChange={setFiltersExpanded}
      />

      <MapLegend 
        zones={zones || []} 
        jobs={jobs || []}
        filters={filters}
        onZoneClick={handleZoneClick}
        isExpanded={legendExpanded}
        onExpandedChange={setLegendExpanded}
      />

      {/* AI Booking Suggestions Panel */}
      {searchedLocation && (
        <BookingSuggestionPanel
          searchedLocation={searchedLocation}
          onClose={handleClearSearch}
          onCollapseFilters={() => {
            setFiltersExpanded(false);
            setLegendExpanded(false);
          }}
        />
      )}

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
