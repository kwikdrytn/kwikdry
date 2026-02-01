import { useState, useCallback, useRef, useEffect } from "react";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  relevance: number;
}

interface AddressSearchProps {
  onLocationSelect: (coords: [number, number], placeName: string) => void;
  onClear?: () => void;
}

export function AddressSearch({ onLocationSelect, onClear }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Geocode the address using Mapbox
  const geocodeAddress = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !MAPBOX_TOKEN) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address,place,postcode&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setResults(data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
          relevance: f.relevance,
        })));
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Effect for debounced search
  useEffect(() => {
    if (debouncedQuery && !selectedPlace) {
      geocodeAddress(debouncedQuery);
    } else if (!debouncedQuery) {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, selectedPlace, geocodeAddress]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: GeocodingResult) => {
    setSelectedPlace(result.place_name);
    setQuery(result.place_name);
    setIsOpen(false);
    setResults([]);
    onLocationSelect(result.center, result.place_name);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedPlace(null);
    setResults([]);
    setIsOpen(false);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedPlace(null);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search for an address..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-10 bg-background"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isSearching && query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-auto">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
