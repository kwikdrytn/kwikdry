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
  custom_role_id: string | null;
  location_id: string | null;
  organization_id: string;
  is_active: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  location?: {
    id: string;
    name: string;
  } | null;
  custom_role?: {
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
  custom_role_id: string | null;
  location_id: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
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
          custom_role_id,
          location_id,
          organization_id,
          is_active,
          avatar_url,
          created_at,
          address,
          city,
          state,
          zip,
          home_lat,
          home_lng,
          locations:location_id (
            id,
            name
          ),
          custom_roles:custom_role_id (
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
        custom_role: user.custom_roles,
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

export function useTechniciansWithLocations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['technicians-with-locations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, home_lat, home_lng, address, city, state, zip')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null)
        .not('home_lat', 'is', null)
        .not('home_lng', 'is', null);

      if (error) throw error;

      return (data || []).map((tech) => ({
        id: tech.id,
        name: `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || 'Unknown',
        lat: tech.home_lat as number,
        lng: tech.home_lng as number,
        address: [tech.address, tech.city, tech.state, tech.zip].filter(Boolean).join(', '),
      }));
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

      // Geocode the address if provided
      let home_lat: number | null = null;
      let home_lng: number | null = null;

      if (data.address && data.city && data.state) {
        const geocoded = await geocodeAddress(data.address, data.city, data.state, data.zip);
        if (geocoded) {
          home_lat = geocoded.lat;
          home_lng = geocoded.lng;
        }
      }

      // Call edge function to invite user and create profile
      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          role: data.role,
          custom_role_id: data.custom_role_id,
          location_id: data.location_id,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          home_lat,
          home_lng,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result.profile;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['technicians-with-locations'] });
      toast.success(`User invited successfully. An email has been sent to ${variables.email}`);
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
      // Geocode the address if address fields changed
      let updateData: Record<string, any> = { ...data };

      if (data.address !== undefined || data.city !== undefined || data.state !== undefined) {
        // Need to fetch current values if not all provided
        const { data: current } = await supabase
          .from('profiles')
          .select('address, city, state, zip')
          .eq('id', id)
          .single();

        const address = data.address ?? current?.address;
        const city = data.city ?? current?.city;
        const state = data.state ?? current?.state;
        const zip = data.zip ?? current?.zip;

        if (address && city && state) {
          const geocoded = await geocodeAddress(address, city, state, zip);
          if (geocoded) {
            updateData.home_lat = geocoded.lat;
            updateData.home_lng = geocoded.lng;
          } else {
            updateData.home_lat = null;
            updateData.home_lng = null;
          }
        } else {
          updateData.home_lat = null;
          updateData.home_lng = null;
        }
      }

      const { data: updatedUser, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['technicians-with-locations'] });
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
      queryClient.invalidateQueries({ queryKey: ['technicians-with-locations'] });
      toast.success('User deactivated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to deactivate user: ${error.message}`);
    },
  });
}

// Geocode address using Mapbox
async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip?: string
): Promise<{ lat: number; lng: number } | null> {
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!MAPBOX_TOKEN) return null;

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const encoded = encodeURIComponent(fullAddress);

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=US`
    );
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
