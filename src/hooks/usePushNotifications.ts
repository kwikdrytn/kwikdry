import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, onMessageListener } from '@/lib/firebase';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    // Check existing subscription
    if (profile?.id) {
      checkSubscription();
    }
  }, [profile?.id]);

  useEffect(() => {
    // Listen for foreground messages
    const unsubscribe = onMessageListener((payload) => {
      toast.info(payload.notification?.title || 'New notification', {
        description: payload.notification?.body,
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const checkSubscription = async () => {
    if (!profile?.id) return;

    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    setIsSubscribed(!!data);
  };

  const subscribe = useCallback(async () => {
    if (!profile?.id || !isSupported) return false;

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();
      
      if (!token) {
        toast.error('Could not get notification permission');
        return false;
      }

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          fcm_token: token,
          is_active: true,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
        }, {
          onConflict: 'user_id,fcm_token',
        });

      if (error) throw error;

      // Also update the profile's fcm_token for quick access
      await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('id', profile.id);

      setIsSubscribed(true);
      toast.success('Push notifications enabled');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Failed to enable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!profile?.id) return false;

    setIsLoading(true);
    try {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', profile.id);

      await supabase
        .from('profiles')
        .update({ fcm_token: null })
        .eq('id', profile.id);

      setIsSubscribed(false);
      toast.success('Push notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
