import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  TechnicianSkill, 
  TechnicianNote, 
  ServiceType, 
  SkillLevel, 
  NoteType,
  SERVICE_TYPES 
} from "@/types/technician";

export function useTechnicianSkills(profileId: string | undefined) {
  return useQuery({
    queryKey: ["technician-skills", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("technician_skills")
        .select("*")
        .eq("profile_id", profileId);

      if (error) throw error;

      // Map database records to our typed interface
      return (data || []).map(skill => ({
        ...skill,
        service_type: skill.service_type as ServiceType,
        skill_level: skill.skill_level as SkillLevel,
      })) as TechnicianSkill[];
    },
    enabled: !!profileId,
  });
}

export function useTechnicianNotes(profileId: string | undefined) {
  return useQuery({
    queryKey: ["technician-notes", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("technician_notes")
        .select("*")
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(note => ({
        ...note,
        note_type: note.note_type as NoteType,
      })) as TechnicianNote[];
    },
    enabled: !!profileId,
  });
}

export function useUpsertSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      serviceType,
      skillLevel,
      notes,
    }: {
      profileId: string;
      serviceType: ServiceType;
      skillLevel: SkillLevel;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("technician_skills")
        .upsert(
          {
            profile_id: profileId,
            service_type: serviceType,
            skill_level: skillLevel,
            notes: notes || null,
          },
          {
            onConflict: "profile_id,service_type",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["technician-skills", variables.profileId] });
      toast.success("Skill updated");
    },
    onError: (error) => {
      toast.error(`Failed to update skill: ${error.message}`);
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      noteType,
      note,
      createdBy,
    }: {
      profileId: string;
      noteType: NoteType;
      note: string;
      createdBy?: string;
    }) => {
      const { data, error } = await supabase
        .from("technician_notes")
        .insert({
          profile_id: profileId,
          note_type: noteType,
          note,
          created_by: createdBy || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["technician-notes", variables.profileId] });
      toast.success("Note added");
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, profileId }: { noteId: string; profileId: string }) => {
      const { error } = await supabase
        .from("technician_notes")
        .update({ is_active: false })
        .eq("id", noteId);

      if (error) throw error;
      return { noteId, profileId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ["technician-notes", variables.profileId] });
      toast.success("Note deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });
}

// Helper to get all skills with defaults for missing service types
export function getSkillsWithDefaults(
  skills: TechnicianSkill[] | undefined
): Record<ServiceType, { skill_level: SkillLevel; notes: string | null; id?: string }> {
  const defaultSkills: Record<ServiceType, { skill_level: SkillLevel; notes: string | null; id?: string }> = {} as any;

  SERVICE_TYPES.forEach(({ value }) => {
    defaultSkills[value] = { skill_level: "standard", notes: null };
  });

  if (skills) {
    skills.forEach((skill) => {
      defaultSkills[skill.service_type] = {
        skill_level: skill.skill_level,
        notes: skill.notes,
        id: skill.id,
      };
    });
  }

  return defaultSkills;
}
