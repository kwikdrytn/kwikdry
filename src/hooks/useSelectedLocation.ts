import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationStore } from "@/stores/useLocationStore";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the effective location id used to scope data queries.
 * - Admins: respects the global LocationSelector (`null` means "All Locations")
 * - Non-admins: always pinned to their assigned `profile.location_id`
 */
export function useSelectedLocationId(): string | null {
  const { profile } = useAuth();
  const { selectedLocationId } = useLocationStore();

  if (profile?.role !== "admin") {
    return profile?.location_id ?? null;
  }

  // Admin: 'all' or null both mean "no location filter"
  if (!selectedLocationId || selectedLocationId === "all") return null;
  return selectedLocationId;
}

/**
 * Returns the list of HCP account IDs that belong to the currently selected
 * location (plus any org-wide accounts with no location). Useful for filtering
 * tables that don't have a `location_id` column directly (hcp_employees,
 * hcp_service_zones, hcp_services) but do have an `hcp_account_id`.
 *
 * Returns `null` when no location filter is active (= include everything).
 */
export function useScopedHcpAccountIds(): {
  accountIds: string[] | null;
  isLoading: boolean;
} {
  const { profile } = useAuth();
  const locationId = useSelectedLocationId();

  const { data, isLoading } = useQuery({
    queryKey: ["scoped-hcp-account-ids", profile?.organization_id, locationId],
    queryFn: async () => {
      if (!profile?.organization_id || !locationId) return null;
      const { data, error } = await supabase
        .from("hcp_accounts")
        .select("id, location_id")
        .eq("organization_id", profile.organization_id)
        .or(`location_id.eq.${locationId},location_id.is.null`);
      if (error) throw error;
      return (data ?? []).map((a) => a.id);
    },
    enabled: !!profile?.organization_id,
  });

  return { accountIds: locationId ? data ?? [] : null, isLoading };
}

/**
 * Ensure the location store is initialised correctly when the auth profile
 * loads. Admins default to "all"; everyone else is pinned to their own
 * `location_id`. Mount this once high in the tree.
 */
export function useSyncLocationStoreToProfile() {
  const { profile } = useAuth();
  const { selectedLocationId, setSelectedLocationId } = useLocationStore();

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "admin") {
      if (selectedLocationId === null) setSelectedLocationId("all");
    } else if (profile.location_id && selectedLocationId !== profile.location_id) {
      setSelectedLocationId(profile.location_id);
    }
  }, [profile, selectedLocationId, setSelectedLocationId]);
}
