import { useState } from "react";
import { Star, AlertTriangle, Minus, Ban, Info } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { 
  useTechnicianSkills, 
  useUpsertSkill, 
  getSkillsWithDefaults 
} from "@/hooks/useTechnicianSkills";
import { 
  SERVICE_TYPES, 
  SKILL_LEVELS, 
  SkillLevel, 
  ServiceType 
} from "@/types/technician";

interface ServiceSkillsTableProps {
  profileId: string;
}

const skillLevelConfig: Record<SkillLevel, { icon: typeof Star; bgClass: string; textClass: string }> = {
  preferred: { icon: Star, bgClass: "bg-success/10", textClass: "text-success" },
  standard: { icon: Minus, bgClass: "bg-muted", textClass: "text-muted-foreground" },
  avoid: { icon: AlertTriangle, bgClass: "bg-warning/10", textClass: "text-warning" },
  never: { icon: Ban, bgClass: "bg-destructive/10", textClass: "text-destructive" },
};

export function ServiceSkillsTable({ profileId }: ServiceSkillsTableProps) {
  const { data: skills, isLoading } = useTechnicianSkills(profileId);
  const upsertSkill = useUpsertSkill();
  const [editingNotes, setEditingNotes] = useState<Record<ServiceType, string>>({} as Record<ServiceType, string>);

  const skillsWithDefaults = getSkillsWithDefaults(skills);

  const handleSkillLevelChange = (serviceType: ServiceType, newLevel: SkillLevel) => {
    const currentSkill = skillsWithDefaults[serviceType];
    upsertSkill.mutate({
      profileId,
      serviceType,
      skillLevel: newLevel,
      notes: currentSkill.notes,
    });
  };

  const handleNotesBlur = (serviceType: ServiceType) => {
    const newNotes = editingNotes[serviceType];
    if (newNotes === undefined) return;

    const currentSkill = skillsWithDefaults[serviceType];
    if (newNotes !== (currentSkill.notes || "")) {
      upsertSkill.mutate({
        profileId,
        serviceType,
        skillLevel: currentSkill.skill_level,
        notes: newNotes || null,
      });
    }
    setEditingNotes((prev) => {
      const next = { ...prev };
      delete next[serviceType];
      return next;
    });
  };

  const getNotesValue = (serviceType: ServiceType) => {
    if (serviceType in editingNotes) {
      return editingNotes[serviceType];
    }
    return skillsWithDefaults[serviceType]?.notes || "";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Skills</CardTitle>
        <CardDescription>
          Set assignment preferences for each service type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Configure how the AI scheduling assistant should assign jobs to this technician.
          </AlertDescription>
        </Alert>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
          {SKILL_LEVELS.map((level) => {
            const config = skillLevelConfig[level.value];
            const Icon = config.icon;
            return (
              <div key={level.value} className={cn("flex items-center gap-2 p-2 rounded-md", config.bgClass)}>
                <Icon className={cn("h-4 w-4", config.textClass)} />
                <div>
                  <span className={cn("font-medium", config.textClass)}>{level.label}</span>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skills Table */}
        <div className="space-y-2">
          {SERVICE_TYPES.map(({ value: serviceType, label }) => {
            const skill = skillsWithDefaults[serviceType];
            const config = skillLevelConfig[skill.skill_level];

            return (
              <div
                key={serviceType}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors",
                  config.bgClass
                )}
              >
                <div className="flex items-center gap-2 min-w-[180px]">
                  {(() => {
                    const Icon = config.icon;
                    return <Icon className={cn("h-4 w-4 flex-shrink-0", config.textClass)} />;
                  })()}
                  <span className="font-medium">{label}</span>
                </div>

                <div className="flex flex-1 items-center gap-3">
                  <Select
                    value={skill.skill_level}
                    onValueChange={(value) => handleSkillLevelChange(serviceType, value as SkillLevel)}
                  >
                    <SelectTrigger className="w-[140px] bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {SKILL_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Notes (optional)"
                    className="flex-1 bg-background"
                    value={getNotesValue(serviceType)}
                    onChange={(e) =>
                      setEditingNotes((prev) => ({ ...prev, [serviceType]: e.target.value }))
                    }
                    onBlur={() => handleNotesBlur(serviceType)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
