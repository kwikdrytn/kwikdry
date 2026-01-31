import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useLocations } from "@/hooks/useUsers";

interface UserFiltersProps {
  locationId: string | null;
  role: string | null;
  onLocationChange: (locationId: string | null) => void;
  onRoleChange: (role: string | null) => void;
}

export function UserFilters({
  locationId,
  role,
  onLocationChange,
  onRoleChange,
}: UserFiltersProps) {
  const { data: locations = [] } = useLocations();
  const hasFilters = locationId || role;

  const clearFilters = () => {
    onLocationChange(null);
    onRoleChange(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={locationId ?? "all"}
        onValueChange={(value) => onLocationChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Locations" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={role ?? "all"}
        onValueChange={(value) => onRoleChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="call_staff">Call Staff</SelectItem>
          <SelectItem value="technician">Technician</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-2 text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
