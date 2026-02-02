import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminTrainingVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  category_id: string | null;
  category_name: string | null;
  is_required: boolean;
  required_for_roles: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  completion_count: number;
}

export interface TrainingCategoryAdmin {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  video_count: number;
}

export function useAdminVideos(categoryFilter?: string | null, searchQuery?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["admin-training-videos", profile?.organization_id, categoryFilter, searchQuery],
    queryFn: async (): Promise<AdminTrainingVideo[]> => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from("training_videos")
        .select(`
          *,
          category:training_categories(name)
        `)
        .eq("organization_id", profile.organization_id)
        .is("deleted_at", null)
        .order("sort_order");

      if (categoryFilter) {
        query = query.eq("category_id", categoryFilter);
      }

      const { data: videos, error } = await query;
      if (error) throw error;

      // Get completion counts
      const videoIds = videos?.map(v => v.id) || [];
      const { data: completions } = await supabase
        .from("training_progress")
        .select("video_id")
        .in("video_id", videoIds)
        .eq("is_completed", true);

      const completionMap = new Map<string, number>();
      completions?.forEach(c => {
        completionMap.set(c.video_id, (completionMap.get(c.video_id) || 0) + 1);
      });

      let result = (videos || []).map((video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        youtube_video_id: video.youtube_video_id,
        thumbnail_url: video.thumbnail_url,
        duration_seconds: video.duration_seconds,
        category_id: video.category_id,
        category_name: (video.category as { name: string } | null)?.name || null,
        is_required: video.is_required,
        required_for_roles: video.required_for_roles || [],
        is_active: video.is_active,
        sort_order: video.sort_order,
        created_at: video.created_at,
        completion_count: completionMap.get(video.id) || 0,
      }));

      // Filter by search query client-side
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        result = result.filter(v => 
          v.title.toLowerCase().includes(lower) ||
          v.description?.toLowerCase().includes(lower)
        );
      }

      return result;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useAdminCategories() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["admin-training-categories", profile?.organization_id],
    queryFn: async (): Promise<TrainingCategoryAdmin[]> => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("training_categories")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .is("deleted_at", null)
        .order("sort_order");

      if (error) throw error;

      // Get video counts per category
      const { data: videos } = await supabase
        .from("training_videos")
        .select("category_id")
        .eq("organization_id", profile.organization_id)
        .is("deleted_at", null);

      const countMap = new Map<string, number>();
      videos?.forEach(v => {
        if (v.category_id) {
          countMap.set(v.category_id, (countMap.get(v.category_id) || 0) + 1);
        }
      });

      return (data || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sort_order: cat.sort_order,
        video_count: countMap.get(cat.id) || 0,
      }));
    },
    enabled: !!profile?.organization_id,
  });
}

export interface VideoFormData {
  title: string;
  description: string;
  youtube_video_id: string;
  thumbnail_url: string;
  duration_seconds: number | null;
  category_id: string | null;
  is_required: boolean;
  required_for_roles: string[];
  is_active: boolean;
}

export function useCreateVideo() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: VideoFormData) => {
      if (!profile?.organization_id) throw new Error("No organization");

      // Get max sort_order
      const { data: existing } = await supabase
        .from("training_videos")
        .select("sort_order")
        .eq("organization_id", profile.organization_id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from("training_videos")
        .insert({
          organization_id: profile.organization_id,
          title: data.title,
          description: data.description || null,
          youtube_video_id: data.youtube_video_id,
          thumbnail_url: data.thumbnail_url,
          duration_seconds: data.duration_seconds,
          category_id: data.category_id,
          is_required: data.is_required,
          required_for_roles: data.required_for_roles,
          is_active: data.is_active,
          sort_order: nextOrder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

export function useUpdateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VideoFormData> }) => {
      const { error } = await supabase
        .from("training_videos")
        .update({
          title: data.title,
          description: data.description || null,
          youtube_video_id: data.youtube_video_id,
          thumbnail_url: data.thumbnail_url,
          duration_seconds: data.duration_seconds,
          category_id: data.category_id,
          is_required: data.is_required,
          required_for_roles: data.required_for_roles,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_videos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

export function useReorderVideos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videos: { id: string; sort_order: number }[]) => {
      const updates = videos.map(v =>
        supabase
          .from("training_videos")
          .update({ sort_order: v.sort_order })
          .eq("id", v.id)
      );

      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

// Category CRUD operations
export interface CategoryFormData {
  name: string;
  description: string | null;
  icon: string;
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (!profile?.organization_id) throw new Error("No organization");

      // Get max sort_order
      const { data: existing } = await supabase
        .from("training_categories")
        .select("sort_order")
        .eq("organization_id", profile.organization_id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order || 0) + 1;

      const { error } = await supabase
        .from("training_categories")
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          description: data.description,
          icon: data.icon,
          sort_order: nextOrder,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-categories"] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryFormData> }) => {
      const { error } = await supabase
        .from("training_categories")
        .update({
          name: data.name,
          description: data.description,
          icon: data.icon,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unassign videos from this category
      await supabase
        .from("training_videos")
        .update({ category_id: null })
        .eq("category_id", id);

      // Then delete the category
      const { error } = await supabase
        .from("training_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-training-videos"] });
      queryClient.invalidateQueries({ queryKey: ["training-videos"] });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categories: { id: string; sort_order: number }[]) => {
      const updates = categories.map(c =>
        supabase
          .from("training_categories")
          .update({ sort_order: c.sort_order })
          .eq("id", c.id)
      );

      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-categories"] });
    },
  });
}

// YouTube URL parsing utilities
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; thumbnail: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title || "",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

export function formatDurationInput(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function parseDurationInput(value: string): number | null {
  const match = value.match(/^(\d+):(\d{1,2})$/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  // Try parsing as just minutes
  const minsOnly = parseInt(value);
  if (!isNaN(minsOnly)) {
    return minsOnly * 60;
  }
  return null;
}
