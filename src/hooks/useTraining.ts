import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_sort_order: number | null;
  is_required: boolean;
  required_for_roles: string[];
  sort_order: number;
  is_completed?: boolean;
  progress_percent?: number;
  last_position_seconds?: number;
  last_watched_at?: string;
}

export interface TrainingCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  videos: TrainingVideo[];
  completedCount: number;
  totalCount: number;
}

export function useTrainingVideos() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["training-videos", profile?.organization_id, profile?.id],
    queryFn: async (): Promise<TrainingVideo[]> => {
      if (!profile?.organization_id || !profile?.id) return [];

      // Fetch videos with category info
      const { data: videos, error: videosError } = await supabase
        .from("training_videos")
        .select(`
          *,
          category:training_categories(
            name,
            icon,
            sort_order
          )
        `)
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order");

      if (videosError) throw videosError;

      // Fetch user's progress for all videos
      const { data: progress, error: progressError } = await supabase
        .from("training_progress")
        .select("*")
        .eq("user_id", profile.id);

      if (progressError) throw progressError;

      // Create a map of progress by video_id
      const progressMap = new Map(
        progress?.map((p) => [p.video_id, p]) || []
      );

      // Combine videos with progress and category info
      return (videos || []).map((video) => {
        const videoProgress = progressMap.get(video.id);
        const category = video.category as { name: string; icon: string; sort_order: number } | null;
        
        return {
          id: video.id,
          title: video.title,
          description: video.description,
          youtube_video_id: video.youtube_video_id,
          thumbnail_url: video.thumbnail_url,
          duration_seconds: video.duration_seconds,
          category_id: video.category_id,
          category_name: category?.name || null,
          category_icon: category?.icon || null,
          category_sort_order: category?.sort_order ?? null,
          is_required: video.is_required,
          required_for_roles: video.required_for_roles || [],
          sort_order: video.sort_order,
          is_completed: videoProgress?.is_completed || false,
          progress_percent: videoProgress?.progress_percent || 0,
          last_position_seconds: videoProgress?.last_position_seconds || 0,
          last_watched_at: videoProgress?.last_watched_at,
        };
      });
    },
    enabled: !!profile?.organization_id && !!profile?.id,
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      videoId,
      progressPercent,
      lastPositionSeconds,
      isCompleted,
    }: {
      videoId: string;
      progressPercent: number;
      lastPositionSeconds: number;
      isCompleted?: boolean;
    }) => {
      if (!profile?.id) throw new Error("User not authenticated");

      const updateData = {
        user_id: profile.id,
        video_id: videoId,
        progress_percent: progressPercent,
        last_position_seconds: lastPositionSeconds,
        is_completed: isCompleted || progressPercent >= 90,
        last_watched_at: new Date().toISOString(),
        completed_at: isCompleted || progressPercent >= 90 ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("training_progress")
        .upsert(updateData, { onConflict: "user_id,video_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
