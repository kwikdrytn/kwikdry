import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface JobChangeEvent {
  id: string;
  organization_id: string;
  hcp_job_id: string;
  change_type: 'cancelled' | 'rescheduled' | 'reassigned';
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  customer_name: string | null;
  technician_name: string | null;
  detected_at: string;
  is_read: boolean;
  read_by: string | null;
}

export function useActivityFeed(filter?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['activity-feed', profile?.organization_id, filter],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('job_change_events' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('detected_at', { ascending: false })
        .limit(100);

      if (filter && filter !== 'all') {
        query = query.eq('change_type', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[] as JobChangeEvent[]) || [];
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useUnreadCount() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['activity-unread-count', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      const { count, error } = await supabase
        .from('job_change_events' as any)
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 60000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('job_change_events' as any)
        .update({ is_read: true })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ queryKey: ['activity-unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization');
      const { error } = await supabase
        .from('job_change_events' as any)
        .update({ is_read: true })
        .eq('organization_id', profile.organization_id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      queryClient.invalidateQueries({ queryKey: ['activity-unread-count'] });
    },
  });
}
