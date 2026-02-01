import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  timezone: string | null;
  is_active: boolean | null;
  organization_id: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface LocationWithTeamCount extends Location {
  team_count: number;
}

export interface LocationFormData {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  timezone?: string;
}

export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
];

export function useLocationsWithTeamCount() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["locations-with-team-count", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get all locations
      const { data: locations, error: locError } = await supabase
        .from("locations")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .is("deleted_at", null)
        .order("name");

      if (locError) throw locError;

      // Get team counts per location
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("location_id")
        .eq("is_active", true)
        .is("deleted_at", null);

      if (profError) throw profError;

      // Count profiles per location
      const teamCounts = new Map<string, number>();
      (profiles || []).forEach((p) => {
        if (p.location_id) {
          teamCounts.set(p.location_id, (teamCounts.get(p.location_id) || 0) + 1);
        }
      });

      return (locations || []).map((loc) => ({
        ...loc,
        team_count: teamCounts.get(loc.id) || 0,
      })) as LocationWithTeamCount[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: LocationFormData) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { data: location, error } = await supabase
        .from("locations")
        .insert({
          ...data,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-team-count"] });
      toast.success("Location created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create location: ${error.message}`);
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LocationFormData }) => {
      const { error } = await supabase
        .from("locations")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-team-count"] });
      toast.success("Location updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update location: ${error.message}`);
    },
  });
}

export function useDeactivateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("locations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-with-team-count"] });
      toast.success("Location deactivated");
    },
    onError: (error) => {
      toast.error(`Failed to deactivate location: ${error.message}`);
    },
  });
}
