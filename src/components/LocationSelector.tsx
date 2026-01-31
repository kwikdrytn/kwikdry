import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationStore } from "@/stores/useLocationStore";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Location {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export function LocationSelector() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const { selectedLocationId, setSelectedLocationId } = useLocationStore();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, city, state')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return data as Location[];
    },
    enabled: !!profile?.organization_id && profile?.role === 'admin',
  });

  // Set default location if none selected
  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {isLoading 
                ? "Loading..." 
                : selectedLocation 
                  ? selectedLocation.name 
                  : "Select location"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-popover border shadow-md z-50">
        <Command>
          <CommandInput placeholder="Search locations..." />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              {locations.map((location) => (
                <CommandItem
                  key={location.id}
                  value={location.name}
                  onSelect={() => {
                    setSelectedLocationId(location.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedLocationId === location.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{location.name}</span>
                    {(location.city || location.state) && (
                      <span className="text-xs text-muted-foreground">
                        {[location.city, location.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
