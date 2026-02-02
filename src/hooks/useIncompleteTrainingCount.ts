import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIncompleteTrainingCount() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["incomplete-training-count", profile?.id, profile?.role],
    queryFn: async (): Promise<number> => {
      if (!profile?.id || !profile?.organization_id || !profile?.role) return 0;

      // Get required videos for this user's role
      const { data: videos, error: videosError } = await supabase
        .from("training_videos")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("is_required", true)
        .eq("is_active", true)
        .is("deleted_at", null)
        .contains("required_for_roles", [profile.role]);

      if (videosError) throw videosError;
      if (!videos || videos.length === 0) return 0;

      const videoIds = videos.map((v) => v.id);

      // Get completed videos
      const { data: progress, error: progressError } = await supabase
        .from("training_progress")
        .select("video_id")
        .eq("user_id", profile.id)
        .eq("is_completed", true)
        .in("video_id", videoIds);

      if (progressError) throw progressError;

      const completedIds = new Set(progress?.map((p) => p.video_id) || []);
      const incompleteCount = videoIds.filter((id) => !completedIds.has(id)).length;

      return incompleteCount;
    },
    enabled: !!profile?.id && !!profile?.organization_id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export interface TrainingStatus {
  requiredCount: number;
  completedCount: number;
  incompleteCount: number;
  progressPercent: number;
}

export function useTrainingStatus() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["training-status", profile?.id, profile?.role],
    queryFn: async (): Promise<TrainingStatus> => {
      if (!profile?.id || !profile?.organization_id || !profile?.role) {
        return { requiredCount: 0, completedCount: 0, incompleteCount: 0, progressPercent: 100 };
      }

      // Get required videos for this user's role
      const { data: videos, error: videosError } = await supabase
        .from("training_videos")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("is_required", true)
        .eq("is_active", true)
        .is("deleted_at", null)
        .contains("required_for_roles", [profile.role]);

      if (videosError) throw videosError;

      const requiredCount = videos?.length || 0;
      if (requiredCount === 0) {
        return { requiredCount: 0, completedCount: 0, incompleteCount: 0, progressPercent: 100 };
      }

      const videoIds = videos!.map((v) => v.id);

      // Get completed videos
      const { data: progress, error: progressError } = await supabase
        .from("training_progress")
        .select("video_id")
        .eq("user_id", profile.id)
        .eq("is_completed", true)
        .in("video_id", videoIds);

      if (progressError) throw progressError;

      const completedCount = progress?.length || 0;
      const incompleteCount = requiredCount - completedCount;
      const progressPercent = Math.round((completedCount / requiredCount) * 100);

      return { requiredCount, completedCount, incompleteCount, progressPercent };
    },
    enabled: !!profile?.id && !!profile?.organization_id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useTeamTrainingStats() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["team-training-stats", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        return { completionRate: 100, membersNeedingAttention: 0 };
      }

      // Get all required videos
      const { data: videos, error: videosError } = await supabase
        .from("training_videos")
        .select("id, required_for_roles")
        .eq("organization_id", profile.organization_id)
        .eq("is_required", true)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (videosError) throw videosError;
      if (!videos || videos.length === 0) {
        return { completionRate: 100, membersNeedingAttention: 0 };
      }

      // Get all team members
      const { data: members, error: membersError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .in("role", ["technician", "call_staff"]);

      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        return { completionRate: 100, membersNeedingAttention: 0 };
      }

      // Get all progress records
      const { data: progressRecords, error: progressError } = await supabase
        .from("training_progress")
        .select("user_id, video_id, is_completed")
        .in("user_id", members.map(m => m.id))
        .eq("is_completed", true);

      if (progressError) throw progressError;

      // Build completion map
      const completionMap = new Map<string, Set<string>>();
      progressRecords?.forEach(p => {
        if (!completionMap.has(p.user_id)) {
          completionMap.set(p.user_id, new Set());
        }
        completionMap.get(p.user_id)!.add(p.video_id);
      });

      // Calculate stats
      let totalRequired = 0;
      let totalCompleted = 0;
      let membersNeedingAttention = 0;

      members.forEach(member => {
        const requiredForMember = videos.filter(v => 
          (v.required_for_roles || []).includes(member.role)
        );
        const requiredCount = requiredForMember.length;
        
        if (requiredCount === 0) return;

        const completedSet = completionMap.get(member.id) || new Set();
        const completedCount = requiredForMember.filter(v => completedSet.has(v.id)).length;

        totalRequired += requiredCount;
        totalCompleted += completedCount;

        const memberProgress = (completedCount / requiredCount) * 100;
        if (memberProgress < 50) {
          membersNeedingAttention++;
        }
      });

      const completionRate = totalRequired > 0 
        ? Math.round((totalCompleted / totalRequired) * 100) 
        : 100;

      return { completionRate, membersNeedingAttention };
    },
    enabled: !!profile?.organization_id,
    staleTime: 1000 * 60 * 5,
  });
}
