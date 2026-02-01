import { Badge } from "@/components/ui/badge";

type MaintenanceType = 'repair' | 'service' | 'inspection' | 'replacement' | 'cleaning';

interface MaintenanceTypeBadgeProps {
  type: MaintenanceType | string;
}

const TYPE_COLORS: Record<MaintenanceType, { bg: string; text: string }> = {
  repair: { bg: 'bg-red-100', text: 'text-red-800' },
  service: { bg: 'bg-blue-100', text: 'text-blue-800' },
  inspection: { bg: 'bg-purple-100', text: 'text-purple-800' },
  replacement: { bg: 'bg-orange-100', text: 'text-orange-800' },
  cleaning: { bg: 'bg-green-100', text: 'text-green-800' },
};

export function MaintenanceTypeBadge({ type }: MaintenanceTypeBadgeProps) {
  const colors = TYPE_COLORS[type as MaintenanceType] || { bg: 'bg-muted', text: 'text-muted-foreground' };
  
  return (
    <Badge 
      className={`${colors.bg} ${colors.text} hover:${colors.bg} capitalize border-0`}
    >
      {type.replace('_', ' ')}
    </Badge>
  );
}
