import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  click_action: string | null;
  sent_at: string | null;
  read_at: string | null;
  delivered: boolean | null;
  data: any;
}

export function useNotifications() {
  const { profile } = useAuth();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('notification_log')
        .select('*')
        .eq('user_id', profile.id)
        .order('sent_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as AppNotification[];
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const queryClient = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notification_log')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!profile?.id) return;
      const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from('notification_log')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
