import { format, parseISO } from "date-fns";
import { Pencil, Eye, MapPin, User, Calendar, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Equipment } from "@/hooks/useEquipment";
import { EquipmentStatusBadge, MaintenanceBadge, MaintenanceWarningIcon } from "./EquipmentStatusBadge";

interface EquipmentCardsProps {
  equipment: Equipment[];
  isLoading: boolean;
  onView: (equipment: Equipment) => void;
  onEdit: (equipment: Equipment) => void;
}

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Extractor',
  wand: 'Wand',
  hose: 'Hose',
  vehicle: 'Vehicle',
  other: 'Other',
};

export function EquipmentCards({ equipment, isLoading, onView, onEdit }: EquipmentCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (equipment.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No equipment found. Add your first piece of equipment to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {equipment.map((item) => {
        const assignedName = item.assigned_first_name || item.assigned_last_name
          ? `${item.assigned_first_name || ''} ${item.assigned_last_name || ''}`.trim()
          : null;

        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MaintenanceWarningIcon nextDue={item.next_maintenance_due} />
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {TYPE_LABELS[item.type] || item.type}
                    </Badge>
                    <EquipmentStatusBadge status={item.status} />
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(item)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {item.serial_number && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="h-4 w-4" />
                  <span className="font-mono">{item.serial_number}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{assignedName || 'Unassigned'}</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{item.location_name || 'No location'}</span>
              </div>
              
              {item.next_maintenance_due && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {format(parseISO(item.next_maintenance_due), 'MMM d, yyyy')}
                  </span>
                  <MaintenanceBadge nextDue={item.next_maintenance_due} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
