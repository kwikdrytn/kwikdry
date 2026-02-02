import { useState, useCallback } from "react";
import { 
  Sofa, Armchair, Wind, Grid3X3, Fan, Bed, TreeDeciduous, 
  RotateCcw, Star, Minus, AlertTriangle, Ban, Loader2,
  MessageSquare, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  label: string;
}> = {
  preferred: { 
    icon: Star, 
    bgClass: "bg-success/10", 
    textClass: "text-success",
    badgeClass: "bg-success/10 text-success border-success/20",
    label: "Preferred"
  },
  standard: { 
    icon: Minus, 
    bgClass: "bg-muted/50", 
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
    label: "Standard"
  },
  avoid: { 
    icon: AlertTriangle, 
    bgClass: "bg-warning/10", 
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    label: "Avoid"
  },
  never: { 
    icon: Ban, 
    bgClass: "bg-destructive/10", 
    textClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Never"
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
  const [expandedNotes, setExpandedNotes] = useState<ServiceType | null>(null);
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

  // Handle notes save
  const handleNotesSave = (serviceType: ServiceType) => {
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
    setExpandedNotes(null);
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
            <Skeleton key={i} className="h-16 w-full" />
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
          const notes = getNotesValue(serviceType);
          const isExpanded = expandedNotes === serviceType;

          return (
            <Card key={serviceType} className={cn("transition-colors", config.bgClass)}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", config.textClass)} />
                    <span className="font-medium">{label}</span>
                  </div>
                  {(notes || isEditable) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedNotes(isExpanded ? null : serviceType)}
                      className="h-8 px-2"
                    >
                      <MessageSquare className={cn("h-4 w-4", notes && "text-primary")} />
                      {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                  )}
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

                {isExpanded && (
                  <div className="space-y-2">
                    {isEditable ? (
                      <>
                        <Textarea
                          placeholder="Add notes about this skill..."
                          className="bg-background min-h-[80px]"
                          value={serviceType in editingNotes ? editingNotes[serviceType] : (notes || "")}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({ ...prev, [serviceType]: e.target.value }))
                          }
                        />
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingNotes((prev) => {
                                const next = { ...prev };
                                delete next[serviceType];
                                return next;
                              });
                              setExpandedNotes(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleNotesSave(serviceType)}>
                            Save Notes
                          </Button>
                        </div>
                      </>
                    ) : (
                      notes && (
                        <p className="text-sm text-muted-foreground bg-background p-2 rounded">
                          {notes}
                        </p>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop layout - Grid with inline notes
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
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
      <CardContent className="space-y-2">
        {SERVICE_TYPES.map(({ value: serviceType, label, icon }) => {
          const skillLevel = getSkillLevel(serviceType);
          const config = skillLevelConfig[skillLevel];
          const Icon = iconMap[icon] || Sofa;
          const notes = getNotesValue(serviceType);

          return (
            <div 
              key={serviceType} 
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-colors",
                config.bgClass
              )}
            >
              {/* Service name */}
              <div className="flex items-center gap-2 w-[160px] shrink-0">
                <Icon className={cn("h-4 w-4", config.textClass)} />
                <span className="font-medium text-sm">{label}</span>
              </div>

              {/* Skill level radio buttons */}
              <RadioGroup
                value={skillLevel}
                onValueChange={(value) => isEditable && handleSkillLevelChange(serviceType, value as SkillLevel)}
                className="flex items-center gap-6"
                disabled={!isEditable}
              >
                {SKILL_LEVELS.map((level) => {
                  const levelConfig = skillLevelConfig[level.value];
                  const isSelected = skillLevel === level.value;
                  return (
                    <div key={level.value} className="flex items-center space-x-1.5">
                      <RadioGroupItem 
                        value={level.value} 
                        id={`${serviceType}-${level.value}-desktop`}
                        className={cn(
                          "h-4 w-4",
                          isSelected && levelConfig.textClass
                        )}
                        disabled={!isEditable}
                      />
                      <Label 
                        htmlFor={`${serviceType}-${level.value}-desktop`}
                        className={cn(
                          "text-xs cursor-pointer",
                          isSelected ? levelConfig.textClass : "text-muted-foreground"
                        )}
                      >
                        {level.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {/* Notes section */}
              <div className="flex-1 min-w-0">
                {isEditable ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={cn(
                          "h-8 px-2 text-xs gap-1.5 max-w-full",
                          notes ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        {notes ? (
                          <span className="truncate">{notes}</span>
                        ) : (
                          <span>Add note</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Notes for {label}</h4>
                        <Textarea
                          placeholder="Add notes about this skill..."
                          className="min-h-[100px]"
                          value={serviceType in editingNotes ? editingNotes[serviceType] : (notes || "")}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({ ...prev, [serviceType]: e.target.value }))
                          }
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleNotesSave(serviceType)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  notes && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {notes}
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
