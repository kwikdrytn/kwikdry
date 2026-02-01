import { format, parseISO } from "date-fns";
import { Pencil, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Equipment } from "@/hooks/useEquipment";
import { EquipmentStatusBadge, MaintenanceBadge } from "./EquipmentStatusBadge";

interface EquipmentTableProps {
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

export function EquipmentTable({ equipment, isLoading, onView, onEdit }: EquipmentTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Serial Number</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Next Maintenance</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => {
            const assignedName = item.assigned_first_name || item.assigned_last_name
              ? `${item.assigned_first_name || ''} ${item.assigned_last_name || ''}`.trim()
              : null;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TYPE_LABELS[item.type] || item.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {item.serial_number || '—'}
                </TableCell>
                <TableCell>
                  <EquipmentStatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  {assignedName || <span className="text-muted-foreground">Unassigned</span>}
                </TableCell>
                <TableCell>
                  {item.location_name || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.next_maintenance_due ? (
                      <>
                        <span className="text-sm">
                          {format(parseISO(item.next_maintenance_due), 'MMM d, yyyy')}
                        </span>
                        <MaintenanceBadge nextDue={item.next_maintenance_due} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(item)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
