import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, Sliders } from "lucide-react";
import { useLocations } from "@/hooks/useUsers";

interface UserFiltersProps {
  locationId: string | null;
  role: string | null;
  hasSkillPreferences: boolean;
  onLocationChange: (locationId: string | null) => void;
  onRoleChange: (role: string | null) => void;
  onSkillPreferencesChange: (hasSkillPreferences: boolean) => void;
}

export function UserFilters({
  locationId,
  role,
  hasSkillPreferences,
  onLocationChange,
  onRoleChange,
  onSkillPreferencesChange,
}: UserFiltersProps) {
  const { data: locations = [] } = useLocations();
  const hasFilters = locationId || role || hasSkillPreferences;

  const clearFilters = () => {
    onLocationChange(null);
    onRoleChange(null);
    onSkillPreferencesChange(false);
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

      <div className="flex items-center space-x-2 px-2 py-1.5 rounded-md border bg-background">
        <Checkbox 
          id="skill-preferences" 
          checked={hasSkillPreferences}
          onCheckedChange={(checked) => onSkillPreferencesChange(checked === true)}
        />
        <Label 
          htmlFor="skill-preferences" 
          className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
        >
          <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
          Has Skill Preferences
        </Label>
      </div>

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
