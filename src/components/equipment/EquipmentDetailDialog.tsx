import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Equipment } from "@/hooks/useEquipment";
import { EquipmentStatusBadge, MaintenanceBadge } from "./EquipmentStatusBadge";

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Extractor',
  wand: 'Wand',
  hose: 'Hose',
  vehicle: 'Vehicle',
  other: 'Other',
};

export function EquipmentDetailDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentDetailDialogProps) {
  if (!equipment) return null;

  const assignedName = equipment.assigned_first_name || equipment.assigned_last_name
    ? `${equipment.assigned_first_name || ''} ${equipment.assigned_last_name || ''}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {equipment.name}
            <EquipmentStatusBadge status={equipment.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{TYPE_LABELS[equipment.type] || equipment.type}</Badge>
            {equipment.next_maintenance_due && (
              <MaintenanceBadge nextDue={equipment.next_maintenance_due} />
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Serial Number</p>
              <p className="font-mono">{equipment.serial_number || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Model</p>
              <p>{equipment.model || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Manufacturer</p>
              <p>{equipment.manufacturer || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p>{equipment.location_name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Assigned To</p>
              <p>{assignedName || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Next Maintenance</p>
              <p>
                {equipment.next_maintenance_due
                  ? format(parseISO(equipment.next_maintenance_due), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Purchase Date</p>
              <p>
                {equipment.purchase_date
                  ? format(parseISO(equipment.purchase_date), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Purchase Price</p>
              <p>
                {equipment.purchase_price
                  ? `$${equipment.purchase_price.toLocaleString()}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Warranty Expiry</p>
              <p>
                {equipment.warranty_expiry
                  ? format(parseISO(equipment.warranty_expiry), 'MMM d, yyyy')
                  : '—'}
              </p>
            </div>
          </div>

          {equipment.description && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Description</p>
                <p>{equipment.description}</p>
              </div>
            </>
          )}

          {equipment.notes && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Notes</p>
                <p>{equipment.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
