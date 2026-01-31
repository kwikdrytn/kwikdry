import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'call_staff' | 'technician';
  location_id: string | null;
  organization_id: string;
  is_active: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  location?: {
    id: string;
    name: string;
  } | null;
}

export interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'admin' | 'call_staff' | 'technician';
  location_id: string | null;
}

export function useUsers(filters?: { locationId?: string | null; role?: string | null }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['users', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          role,
          location_id,
          organization_id,
          is_active,
          avatar_url,
          created_at,
          locations:location_id (
            id,
            name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('first_name');

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }

      if (filters?.role && ['admin', 'call_staff', 'technician'].includes(filters.role)) {
        query = query.eq('role', filters.role as 'admin' | 'call_staff' | 'technician');
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((user: any) => ({
        ...user,
        location: user.locations,
      })) as UserProfile[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useLocations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['locations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('locations')
        .select('id, name, city, state')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Note: In a real app, you'd create the auth user first via an edge function
      // For now, we'll just create the profile (assuming user_id would come from auth)
      const { data: newUser, error } = await supabase
        .from('profiles')
        .insert({
          ...data,
          organization_id: profile.organization_id,
          user_id: crypto.randomUUID(), // Placeholder - in real app, this comes from auth
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const { data: updatedUser, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update user: ${error.message}`);
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to deactivate user: ${error.message}`);
    },
  });
}
