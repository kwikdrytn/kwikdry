import { Badge } from "@/components/ui/badge";
import { EquipmentStatus } from "@/hooks/useEquipment";
import { differenceInDays, parseISO, isValid } from "date-fns";

interface EquipmentStatusBadgeProps {
  status: EquipmentStatus;
}

export function EquipmentStatusBadge({ status }: EquipmentStatusBadgeProps) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      );
    case 'maintenance':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Maintenance
        </Badge>
      );
    case 'retired':
      return (
        <Badge variant="secondary">
          Retired
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface MaintenanceBadgeProps {
  nextDue: string | null | undefined;
}

export function MaintenanceBadge({ nextDue }: MaintenanceBadgeProps) {
  if (!nextDue) return null;

  const dueDate = parseISO(nextDue);
  if (!isValid(dueDate)) return null;

  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);

  if (daysUntilDue < 0) {
    return (
      <Badge variant="destructive" className="text-xs">
        Overdue
      </Badge>
    );
  }

  if (daysUntilDue <= 7) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
        Due Soon
      </Badge>
    );
  }

  return null;
}
