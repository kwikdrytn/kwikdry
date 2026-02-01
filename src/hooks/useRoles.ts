import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Permission keys matching the database enum
export type PermissionKey =
  | 'dashboard.view'
  | 'dashboard.view_metrics'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.adjust_stock'
  | 'checklists.submit'
  | 'checklists.view_submissions'
  | 'checklists.manage_templates'
  | 'equipment.view'
  | 'equipment.manage'
  | 'calls.view'
  | 'calls.view_metrics'
  | 'calls.manage'
  | 'job_map.view'
  | 'job_map.use_ai_suggestions'
  | 'users.view'
  | 'users.manage'
  | 'locations.view'
  | 'locations.manage'
  | 'settings.view'
  | 'settings.manage_integrations';

// Permission groups for UI organization
export const PERMISSION_GROUPS = {
  dashboard: {
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard' },
      { key: 'dashboard.view_metrics', label: 'View Metrics & Analytics' },
    ],
  },
  inventory: {
    label: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory' },
      { key: 'inventory.manage', label: 'Manage Items (Create/Edit/Delete)' },
      { key: 'inventory.adjust_stock', label: 'Adjust Stock Levels' },
    ],
  },
  checklists: {
    label: 'Checklists',
    permissions: [
      { key: 'checklists.submit', label: 'Submit Checklists' },
      { key: 'checklists.view_submissions', label: 'View All Submissions' },
      { key: 'checklists.manage_templates', label: 'Manage Templates' },
    ],
  },
  equipment: {
    label: 'Equipment',
    permissions: [
      { key: 'equipment.view', label: 'View Equipment' },
      { key: 'equipment.manage', label: 'Manage Equipment' },
    ],
  },
  calls: {
    label: 'Calls',
    permissions: [
      { key: 'calls.view', label: 'View Call Log' },
      { key: 'calls.view_metrics', label: 'View Call Metrics' },
      { key: 'calls.manage', label: 'Manage Calls (Notes, Booking)' },
    ],
  },
  job_map: {
    label: 'Job Map',
    permissions: [
      { key: 'job_map.view', label: 'View Job Map' },
      { key: 'job_map.use_ai_suggestions', label: 'Use AI Booking Suggestions' },
    ],
  },
  users: {
    label: 'Users',
    permissions: [
      { key: 'users.view', label: 'View Users' },
      { key: 'users.manage', label: 'Manage Users' },
    ],
  },
  locations: {
    label: 'Locations',
    permissions: [
      { key: 'locations.view', label: 'View Locations' },
      { key: 'locations.manage', label: 'Manage Locations' },
    ],
  },
  settings: {
    label: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.manage_integrations', label: 'Manage Integrations' },
    ],
  },
} as const;

// Default permissions for legacy roles
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: Object.values(PERMISSION_GROUPS).flatMap(g => g.permissions.map(p => p.key as PermissionKey)),
  call_staff: [
    'dashboard.view',
    'calls.view',
    'calls.manage',
    'job_map.view',
    'job_map.use_ai_suggestions',
  ],
  technician: [
    'dashboard.view',
    'inventory.view',
    'inventory.adjust_stock',
    'checklists.submit',
  ],
};

export interface CustomRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends CustomRole {
  permissions: PermissionKey[];
}

export function useCustomRoles() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['custom-roles', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data: roles, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('is_system', { ascending: false })
        .order('name');

      if (rolesError) throw rolesError;

      // Get permissions for all roles
      const roleIds = (roles || []).map(r => r.id);
      const { data: permissions, error: permError } = await supabase
        .from('role_permissions')
        .select('role_id, permission')
        .in('role_id', roleIds);

      if (permError) throw permError;

      // Group permissions by role
      const permMap = new Map<string, PermissionKey[]>();
      (permissions || []).forEach(p => {
        const existing = permMap.get(p.role_id) || [];
        existing.push(p.permission as PermissionKey);
        permMap.set(p.role_id, existing);
      });

      return (roles || []).map(role => ({
        ...role,
        permissions: permMap.get(role.id) || [],
      })) as RoleWithPermissions[];
    },
    enabled: !!profile?.organization_id,
  });
}

export interface CreateRoleData {
  name: string;
  description?: string;
  permissions: PermissionKey[];
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateRoleData) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Create the role
      const { data: role, error: roleError } = await supabase
        .from('custom_roles')
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          description: data.description || null,
          is_system: false,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Add permissions
      if (data.permissions.length > 0) {
        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(
            data.permissions.map(p => ({
              role_id: role.id,
              permission: p,
            }))
          );

        if (permError) throw permError;
      }

      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Role created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create role: ${error.message}`);
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateRoleData> }) => {
      // Update role details if provided
      if (data.name !== undefined || data.description !== undefined) {
        const updates: Record<string, any> = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description;

        const { error } = await supabase
          .from('custom_roles')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }

      // Update permissions if provided
      if (data.permissions !== undefined) {
        // Delete existing permissions
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', id);

        // Add new permissions
        if (data.permissions.length > 0) {
          const { error } = await supabase
            .from('role_permissions')
            .insert(
              data.permissions.map(p => ({
                role_id: id,
                permission: p,
              }))
            );

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', id)
        .eq('is_system', false); // Can't delete system roles

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      toast.success('Role deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete role: ${error.message}`);
    },
  });
}

// Hook to get current user's permissions
export function useUserPermissions() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['user-permissions', profile?.id, profile?.role, profile?.custom_role_id],
    queryFn: async () => {
      if (!profile) return [];

      // If user has a custom role, fetch those permissions
      if (profile.custom_role_id) {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('permission')
          .eq('role_id', profile.custom_role_id);

        if (error) throw error;
        return (data || []).map(p => p.permission as PermissionKey);
      }

      // Otherwise, use default permissions for legacy role
      // Admin has all permissions
      if (profile.role === 'admin') {
        return Object.values(PERMISSION_GROUPS).flatMap(g => 
          g.permissions.map(p => p.key as PermissionKey)
        );
      }

      return DEFAULT_ROLE_PERMISSIONS[profile.role] || [];
    },
    enabled: !!profile,
  });
}

// Convenience hook to check a single permission
export function useHasPermission(permission: PermissionKey): boolean {
  const { data: permissions, isLoading } = useUserPermissions();
  const { profile } = useAuth();

  // Admin always has all permissions
  if (profile?.role === 'admin') return true;
  
  if (isLoading || !permissions) return false;
  return permissions.includes(permission);
}
