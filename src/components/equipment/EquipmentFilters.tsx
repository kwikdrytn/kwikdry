import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocations } from "@/hooks/useLocations";
import { useTechnicians, EquipmentStatus } from "@/hooks/useEquipment";

interface EquipmentFiltersProps {
  search: string;
  type: string | null;
  status: EquipmentStatus | null;
  locationId: string | null;
  assignedTo: string | null;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string | null) => void;
  onStatusChange: (value: EquipmentStatus | null) => void;
  onLocationChange: (value: string | null) => void;
  onAssignedToChange: (value: string | null) => void;
}

const EQUIPMENT_TYPES = [
  { value: 'extractor', label: 'Extractor' },
  { value: 'wand', label: 'Wand' },
  { value: 'hose', label: 'Hose' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export function EquipmentFilters({
  search,
  type,
  status,
  locationId,
  assignedTo,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onLocationChange,
  onAssignedToChange,
}: EquipmentFiltersProps) {
  const { data: locations = [] } = useLocations();
  const { data: technicians = [] } = useTechnicians();

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name or serial number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={type || "all"} onValueChange={(v) => onTypeChange(v === "all" ? null : v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {EQUIPMENT_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? null : v as EquipmentStatus)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={locationId || "all"} onValueChange={(v) => onLocationChange(v === "all" ? null : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>
              {loc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={assignedTo || "all"} onValueChange={(v) => onAssignedToChange(v === "all" ? null : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Assigned To" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Technicians</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {technicians.map((tech) => (
            <SelectItem key={tech.id} value={tech.id}>
              {tech.first_name} {tech.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
