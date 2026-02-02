import { TechnicianSkillsGrid } from "./TechnicianSkillsGrid";
import { SchedulingNotesList } from "./SchedulingNotesList";

interface SkillsPreferencesTabProps {
  profileId: string;
  isEditable?: boolean;
}

export function SkillsPreferencesTab({ profileId, isEditable = true }: SkillsPreferencesTabProps) {
  return (
    <div className="space-y-6">
      <TechnicianSkillsGrid profileId={profileId} isEditable={isEditable} />
      <SchedulingNotesList profileId={profileId} />
    </div>
  );
}
