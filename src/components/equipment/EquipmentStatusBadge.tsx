import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EquipmentStatus } from "@/hooks/useEquipment";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { AlertTriangle } from "lucide-react";

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

interface MaintenanceWarningIconProps {
  nextDue: string | null | undefined;
  size?: 'sm' | 'md';
}

export function MaintenanceWarningIcon({ nextDue, size = 'sm' }: MaintenanceWarningIconProps) {
  if (!nextDue) return null;

  const dueDate = parseISO(nextDue);
  if (!isValid(dueDate)) return null;

  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;

  if (!isOverdue && !isDueSoon) return null;

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const colorClass = isOverdue ? 'text-destructive' : 'text-yellow-600';
  const label = isOverdue 
    ? `Overdue by ${Math.abs(daysUntilDue)} days` 
    : `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle className={`${iconSize} ${colorClass} shrink-0`} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{isOverdue ? 'Maintenance Overdue' : 'Maintenance Due Soon'}</p>
          <p className="text-xs text-muted-foreground">
            {format(dueDate, 'MMM d, yyyy')} ({label})
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
