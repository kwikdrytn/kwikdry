import { ServiceSkillsTable } from "./ServiceSkillsTable";
import { SchedulingNotesList } from "./SchedulingNotesList";

interface SkillsPreferencesTabProps {
  profileId: string;
}

export function SkillsPreferencesTab({ profileId }: SkillsPreferencesTabProps) {
  return (
    <div className="space-y-6">
      <ServiceSkillsTable profileId={profileId} />
      <SchedulingNotesList profileId={profileId} />
    </div>
  );
}
