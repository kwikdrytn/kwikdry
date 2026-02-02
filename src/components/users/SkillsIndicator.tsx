import { Star, Ban, AlertTriangle, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TechnicianSkillSummary, summarizeSkills } from "@/hooks/useUsers";
import { SERVICE_TYPES } from "@/types/technician";

interface SkillsIndicatorProps {
  skills: TechnicianSkillSummary[] | undefined;
  compact?: boolean;
}

const skillLevelLabels: Record<string, string> = {
  preferred: "Preferred",
  standard: "Standard",
  avoid: "Avoid",
  never: "Never",
};

const skillLevelConfig: Record<string, { icon: typeof Star; textClass: string; bgClass: string }> = {
  preferred: { icon: Star, textClass: "text-success", bgClass: "bg-success/10" },
  standard: { icon: Minus, textClass: "text-muted-foreground", bgClass: "bg-muted" },
  avoid: { icon: AlertTriangle, textClass: "text-warning", bgClass: "bg-warning/10" },
  never: { icon: Ban, textClass: "text-destructive", bgClass: "bg-destructive/10" },
};

export function SkillsIndicator({ skills, compact = false }: SkillsIndicatorProps) {
  const summary = summarizeSkills(skills);

  if (!summary.hasPreferences) {
    return (
      <span className="text-muted-foreground text-sm">Standard</span>
    );
  }

  // Build skill details for popover
  const skillsByLevel = {
    preferred: skills?.filter(s => s.skill_level === 'preferred') || [],
    avoid: skills?.filter(s => s.skill_level === 'avoid') || [],
    never: skills?.filter(s => s.skill_level === 'never') || [],
  };

  const getServiceLabel = (serviceType: string) => {
    return SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="flex items-center gap-1.5 hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {summary.preferred > 0 && (
            <Badge 
              variant="outline" 
              className="bg-success/10 text-success border-success/20 text-xs gap-1 px-1.5"
            >
              <Star className="h-3 w-3" />
              {summary.preferred}
            </Badge>
          )}
          {summary.avoid > 0 && (
            <Badge 
              variant="outline" 
              className="bg-warning/10 text-warning border-warning/20 text-xs gap-1 px-1.5"
            >
              <AlertTriangle className="h-3 w-3" />
              {summary.avoid}
            </Badge>
          )}
          {summary.never > 0 && (
            <Badge 
              variant="outline" 
              className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1 px-1.5"
            >
              <Ban className="h-3 w-3" />
              {summary.never}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 bg-popover" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Skill Preferences</h4>
          
          {skillsByLevel.preferred.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                <Star className="h-3 w-3" />
                Preferred
              </div>
              <div className="pl-4 space-y-0.5">
                {skillsByLevel.preferred.map(skill => (
                  <p key={skill.service_type} className="text-xs text-muted-foreground">
                    {getServiceLabel(skill.service_type)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {skillsByLevel.avoid.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3 w-3" />
                Avoid
              </div>
              <div className="pl-4 space-y-0.5">
                {skillsByLevel.avoid.map(skill => (
                  <p key={skill.service_type} className="text-xs text-muted-foreground">
                    {getServiceLabel(skill.service_type)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {skillsByLevel.never.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <Ban className="h-3 w-3" />
                Never
              </div>
              <div className="pl-4 space-y-0.5">
                {skillsByLevel.never.map(skill => (
                  <p key={skill.service_type} className="text-xs text-muted-foreground">
                    {getServiceLabel(skill.service_type)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
