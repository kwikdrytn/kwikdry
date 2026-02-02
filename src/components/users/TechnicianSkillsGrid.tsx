import { useState, useCallback } from "react";
import { 
  Sofa, Armchair, Wind, Grid3X3, Fan, Bed, TreeDeciduous, 
  RotateCcw, Star, Minus, AlertTriangle, Ban, Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTechnicianSkills, useUpsertSkill, getSkillsWithDefaults } from "@/hooks/useTechnicianSkills";
import { SERVICE_TYPES, SKILL_LEVELS, SkillLevel, ServiceType } from "@/types/technician";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TechnicianSkillsGridProps {
  profileId: string;
  isEditable?: boolean;
}

const iconMap: Record<string, typeof Sofa> = {
  Sofa,
  Armchair,
  Wind,
  Grid3X3,
  Fan,
  Bed,
  TreeDeciduous,
};

const skillLevelConfig: Record<SkillLevel, { 
  icon: typeof Star; 
  bgClass: string; 
  textClass: string;
  badgeClass: string;
}> = {
  preferred: { 
    icon: Star, 
    bgClass: "bg-success/10", 
    textClass: "text-success",
    badgeClass: "bg-success/10 text-success border-success/20"
  },
  standard: { 
    icon: Minus, 
    bgClass: "bg-muted", 
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground"
  },
  avoid: { 
    icon: AlertTriangle, 
    bgClass: "bg-warning/10", 
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20"
  },
  never: { 
    icon: Ban, 
    bgClass: "bg-destructive/10", 
    textClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20"
  },
};

export function TechnicianSkillsGrid({ profileId, isEditable = true }: TechnicianSkillsGridProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: skills, isLoading } = useTechnicianSkills(profileId);
  const upsertSkill = useUpsertSkill();
  
  // Local optimistic state
  const [optimisticSkills, setOptimisticSkills] = useState<Record<ServiceType, SkillLevel>>({} as Record<ServiceType, SkillLevel>);
  const [editingNotes, setEditingNotes] = useState<Record<ServiceType, string>>({} as Record<ServiceType, string>);
  const [isResetting, setIsResetting] = useState(false);

  const skillsWithDefaults = getSkillsWithDefaults(skills);

  // Get skill level (optimistic first, then actual)
  const getSkillLevel = (serviceType: ServiceType): SkillLevel => {
    if (serviceType in optimisticSkills) {
      return optimisticSkills[serviceType];
    }
    return skillsWithDefaults[serviceType]?.skill_level || "standard";
  };

  // Handle skill level change with optimistic update
  const handleSkillLevelChange = useCallback((serviceType: ServiceType, newLevel: SkillLevel) => {
    const previousLevel = getSkillLevel(serviceType);
    
    // Optimistic update
    setOptimisticSkills(prev => ({ ...prev, [serviceType]: newLevel }));

    const currentSkill = skillsWithDefaults[serviceType];
    upsertSkill.mutate(
      {
        profileId,
        serviceType,
        skillLevel: newLevel,
        notes: currentSkill.notes,
      },
      {
        onSuccess: () => {
          // Clear optimistic state on success
          setOptimisticSkills(prev => {
            const next = { ...prev };
            delete next[serviceType];
            return next;
          });
        },
        onError: () => {
          // Revert on error
          setOptimisticSkills(prev => {
            const next = { ...prev };
            delete next[serviceType];
            return next;
          });
          toast.error("Failed to update skill, reverting...");
        },
      }
    );
  }, [profileId, skillsWithDefaults, upsertSkill]);

  // Handle notes blur
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

  // Reset all to standard
  const handleResetAll = async () => {
    setIsResetting(true);
    
    try {
      const promises = SERVICE_TYPES.map(({ value }) => {
        const currentSkill = skillsWithDefaults[value];
        if (currentSkill.skill_level !== "standard") {
          return upsertSkill.mutateAsync({
            profileId,
            serviceType: value,
            skillLevel: "standard",
            notes: currentSkill.notes,
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["technician-skills", profileId] });
      toast.success("All skills reset to Standard");
    } catch (error) {
      toast.error("Failed to reset some skills");
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Mobile card-based layout
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Service Skills</h3>
          {isEditable && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetAll}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset All
            </Button>
          )}
        </div>

        {SERVICE_TYPES.map(({ value: serviceType, label, icon }) => {
          const skillLevel = getSkillLevel(serviceType);
          const config = skillLevelConfig[skillLevel];
          const Icon = iconMap[icon] || Sofa;

          return (
            <Card key={serviceType} className={cn("transition-colors", config.bgClass)}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", config.textClass)} />
                  <span className="font-medium">{label}</span>
                </div>

                {isEditable ? (
                  <RadioGroup
                    value={skillLevel}
                    onValueChange={(value) => handleSkillLevelChange(serviceType, value as SkillLevel)}
                    className="flex flex-wrap gap-2"
                  >
                    {SKILL_LEVELS.map((level) => {
                      const levelConfig = skillLevelConfig[level.value];
                      return (
                        <div key={level.value} className="flex items-center space-x-2">
                          <RadioGroupItem 
                            value={level.value} 
                            id={`${serviceType}-${level.value}`}
                            className={cn(
                              skillLevel === level.value && levelConfig.textClass
                            )}
                          />
                          <Label 
                            htmlFor={`${serviceType}-${level.value}`}
                            className={cn(
                              "text-sm cursor-pointer",
                              skillLevel === level.value && levelConfig.textClass
                            )}
                          >
                            {level.label}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <Badge variant="outline" className={config.badgeClass}>
                    {SKILL_LEVELS.find(l => l.value === skillLevel)?.label}
                  </Badge>
                )}

                {isEditable ? (
                  <Input
                    placeholder="Notes (optional)"
                    className="bg-background"
                    value={getNotesValue(serviceType)}
                    onChange={(e) =>
                      setEditingNotes((prev) => ({ ...prev, [serviceType]: e.target.value }))
                    }
                    onBlur={() => handleNotesBlur(serviceType)}
                  />
                ) : (
                  getNotesValue(serviceType) && (
                    <p className="text-sm text-muted-foreground">
                      Notes: {getNotesValue(serviceType)}
                    </p>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop table layout
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Service Skills</CardTitle>
        {isEditable && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetAll}
            disabled={isResetting}
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reset to Standard
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Service Type</TableHead>
              {SKILL_LEVELS.map((level) => (
                <TableHead key={level.value} className="text-center w-[100px]">
                  {level.label}
                </TableHead>
              ))}
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SERVICE_TYPES.map(({ value: serviceType, label, icon }) => {
              const skillLevel = getSkillLevel(serviceType);
              const config = skillLevelConfig[skillLevel];
              const Icon = iconMap[icon] || Sofa;

              return (
                <TableRow key={serviceType} className={cn("transition-colors", config.bgClass)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.textClass)} />
                      <span className="font-medium">{label}</span>
                    </div>
                  </TableCell>
                  
                  {SKILL_LEVELS.map((level) => (
                    <TableCell key={level.value} className="text-center">
                      {isEditable ? (
                        <RadioGroup
                          value={skillLevel}
                          onValueChange={(value) => handleSkillLevelChange(serviceType, value as SkillLevel)}
                          className="flex justify-center"
                        >
                          <RadioGroupItem
                            value={level.value}
                            id={`${serviceType}-${level.value}-table`}
                            className={cn(
                              "h-5 w-5",
                              skillLevel === level.value && skillLevelConfig[level.value].textClass
                            )}
                          />
                        </RadioGroup>
                      ) : (
                        <div className="flex justify-center">
                          {skillLevel === level.value ? (
                            <div className={cn(
                              "h-3 w-3 rounded-full",
                              level.value === "preferred" && "bg-success",
                              level.value === "standard" && "bg-muted-foreground",
                              level.value === "avoid" && "bg-warning",
                              level.value === "never" && "bg-destructive",
                            )} />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />
                          )}
                        </div>
                      )}
                    </TableCell>
                  ))}
                  
                  <TableCell>
                    {isEditable ? (
                      <Input
                        placeholder="Notes..."
                        className="bg-background h-8 text-sm"
                        value={getNotesValue(serviceType)}
                        onChange={(e) =>
                          setEditingNotes((prev) => ({ ...prev, [serviceType]: e.target.value }))
                        }
                        onBlur={() => handleNotesBlur(serviceType)}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {getNotesValue(serviceType) || "-"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
