import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type EquipmentStatus = 'active' | 'maintenance' | 'retired';
export type EquipmentType = 'extractor' | 'wand' | 'hose' | 'vehicle' | 'other';

export interface Equipment {
  id: string;
  name: string;
  type: string;
  description: string | null;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  status: EquipmentStatus;
  location_id: string | null;
  assigned_to: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_expiry: string | null;
  notes: string | null;
  organization_id: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  // Joined fields
  location_name?: string;
  assigned_first_name?: string | null;
  assigned_last_name?: string | null;
  next_maintenance_due?: string | null;
}

export interface EquipmentFormData {
  name: string;
  type: string;
  description?: string;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  status: EquipmentStatus;
  location_id?: string | null;
  assigned_to?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  warranty_expiry?: string | null;
  notes?: string;
}

export interface EquipmentFilters {
  search?: string | null;
  type?: string | null;
  status?: EquipmentStatus | null;
  locationId?: string | null;
  assignedTo?: string | null;
}

export function useEquipmentList(filters?: EquipmentFilters) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['equipment', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get equipment with location and assigned user
      let query = supabase
        .from('equipment')
        .select(`
          *,
          locations:location_id (name),
          profiles:assigned_to (first_name, last_name)
        `)
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('name');

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);
      }

      const { data: equipmentData, error } = await query;
      if (error) throw error;

      // Get next maintenance due for each equipment
      const equipmentIds = equipmentData.map(e => e.id);
      
      const { data: maintenanceData } = await supabase
        .from('equipment_maintenance')
        .select('equipment_id, next_due')
        .in('equipment_id', equipmentIds)
        .not('next_due', 'is', null)
        .order('next_due', { ascending: true });

      // Create a map of equipment_id to next maintenance due
      const maintenanceMap: Record<string, string> = {};
      maintenanceData?.forEach(m => {
        if (!maintenanceMap[m.equipment_id]) {
          maintenanceMap[m.equipment_id] = m.next_due!;
        }
      });

      return equipmentData.map((e: any) => ({
        ...e,
        location_name: e.locations?.name || null,
        assigned_first_name: e.profiles?.first_name || null,
        assigned_last_name: e.profiles?.last_name || null,
        next_maintenance_due: maintenanceMap[e.id] || null,
      })) as Equipment[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useEquipmentItem(equipmentId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['equipment-item', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return null;

      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          locations:location_id (name),
          profiles:assigned_to (first_name, last_name)
        `)
        .eq('id', equipmentId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        location_name: (data as any).locations?.name || null,
        assigned_first_name: (data as any).profiles?.first_name || null,
        assigned_last_name: (data as any).profiles?.last_name || null,
      } as Equipment;
    },
    enabled: !!equipmentId && !!profile?.organization_id,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: EquipmentFormData) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: newEquipment, error } = await supabase
        .from('equipment')
        .insert({
          ...data,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return newEquipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create equipment: ${error.message}`);
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EquipmentFormData> }) => {
      const { data: updatedEquipment, error } = await supabase
        .from('equipment')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedEquipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-item'] });
      toast.success('Equipment updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update equipment: ${error.message}`);
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from('equipment')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete equipment: ${error.message}`);
    },
  });
}

export function useEquipmentMaintenance(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-maintenance', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return [];

      const { data, error } = await supabase
        .from('equipment_maintenance')
        .select(`
          *,
          profiles:performed_by (first_name, last_name)
        `)
        .eq('equipment_id', equipmentId)
        .order('performed_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!equipmentId,
  });
}

export function useTechnicians() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['technicians', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, location_id')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('first_name');

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useTechniciansByLocation(locationId: string | null | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['technicians-by-location', profile?.organization_id, locationId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, location_id')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('first_name');

      // If location is specified, filter by it
      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCheckSerialNumber(serialNumber: string | null, excludeEquipmentId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['check-serial-number', profile?.organization_id, serialNumber, excludeEquipmentId],
    queryFn: async () => {
      if (!profile?.organization_id || !serialNumber || serialNumber.trim() === '') {
        return { isDuplicate: false, existingName: null };
      }

      let query = supabase
        .from('equipment')
        .select('id, name, serial_number')
        .eq('organization_id', profile.organization_id)
        .eq('serial_number', serialNumber.trim())
        .is('deleted_at', null);

      if (excludeEquipmentId) {
        query = query.neq('id', excludeEquipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        return { isDuplicate: true, existingName: data[0].name };
      }
      
      return { isDuplicate: false, existingName: null };
    },
    enabled: !!profile?.organization_id && !!serialNumber && serialNumber.trim() !== '',
  });
}

export interface MaintenanceFormData {
  equipment_id: string;
  type: 'repair' | 'service' | 'inspection' | 'replacement' | 'cleaning';
  description: string;
  performed_at: string;
  performed_by?: string | null;
  cost?: number | null;
  vendor?: string | null;
  next_due?: string | null;
  notes?: string | null;
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MaintenanceFormData) => {
      const insertData: {
        equipment_id: string;
        type: 'repair' | 'service' | 'inspection' | 'replacement' | 'cleaning';
        description: string;
        performed_at: string;
        performed_by?: string | null;
        cost?: number | null;
        vendor?: string | null;
        next_due?: string | null;
        notes?: string | null;
      } = {
        equipment_id: data.equipment_id,
        type: data.type,
        description: data.description,
        performed_at: data.performed_at,
        performed_by: data.performed_by,
        cost: data.cost,
        vendor: data.vendor,
        next_due: data.next_due,
        notes: data.notes,
      };

      const { data: newRecord, error } = await supabase
        .from('equipment_maintenance')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return newRecord;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenance', variables.equipment_id] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Maintenance record added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add maintenance record: ${error.message}`);
    },
  });
}

// Get total maintenance cost for an equipment
export function useEquipmentMaintenanceCost(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-maintenance-cost', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return 0;

      const { data, error } = await supabase
        .from('equipment_maintenance')
        .select('cost')
        .eq('equipment_id', equipmentId);

      if (error) throw error;
      
      const total = data?.reduce((sum, record) => sum + (Number(record.cost) || 0), 0) || 0;
      return total;
    },
    enabled: !!equipmentId,
  });
}

// Get all equipment needing maintenance (overdue or due within 7 days)
export function useEquipmentNeedingMaintenance() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['equipment-needing-maintenance', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get all equipment with maintenance records
      const { data: equipment, error: equipError } = await supabase
        .from('equipment')
        .select(`
          id,
          name,
          type,
          status,
          locations:location_id (name)
        `)
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .neq('status', 'retired');

      if (equipError) throw equipError;

      const equipmentIds = equipment.map(e => e.id);

      // Get all maintenance records with next_due
      const { data: maintenanceData, error: maintError } = await supabase
        .from('equipment_maintenance')
        .select('equipment_id, next_due')
        .in('equipment_id', equipmentIds)
        .not('next_due', 'is', null)
        .order('next_due', { ascending: true });

      if (maintError) throw maintError;

      // Get the earliest next_due for each equipment
      const nextDueMap: Record<string, string> = {};
      maintenanceData?.forEach(m => {
        if (!nextDueMap[m.equipment_id] && m.next_due) {
          nextDueMap[m.equipment_id] = m.next_due;
        }
      });

      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Filter equipment needing maintenance
      const needingMaintenance = equipment
        .filter(e => {
          const nextDue = nextDueMap[e.id];
          if (!nextDue) return false;
          const dueDate = new Date(nextDue);
          return dueDate <= sevenDaysFromNow;
        })
        .map(e => {
          const nextDue = nextDueMap[e.id];
          const dueDate = new Date(nextDue);
          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: e.id,
            name: e.name,
            type: e.type,
            status: e.status,
            location_name: (e as any).locations?.name || null,
            next_due: nextDue,
            days_until_due: daysUntilDue,
            is_overdue: daysUntilDue < 0,
          };
        })
        .sort((a, b) => a.days_until_due - b.days_until_due);

      return needingMaintenance;
    },
    enabled: !!profile?.organization_id,
  });
}
