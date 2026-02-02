import { TechnicianSkillsGrid } from "./TechnicianSkillsGrid";
import { TechnicianNotesSection } from "./TechnicianNotesSection";

interface SkillsPreferencesTabProps {
  profileId: string;
  isEditable?: boolean;
}

export function SkillsPreferencesTab({ profileId, isEditable = true }: SkillsPreferencesTabProps) {
  return (
    <div className="space-y-6">
      <TechnicianSkillsGrid profileId={profileId} isEditable={isEditable} />
      <TechnicianNotesSection profileId={profileId} isEditable={isEditable} />
    </div>
  );
}
