import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type InventoryCategory = 'cleaning_solution' | 'supply' | 'consumable';
export type InventoryUnit = 'gallon' | 'oz' | 'liter' | 'ml' | 'each' | 'box' | 'case' | 'roll' | 'bag';

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  expiration_date: string | null;
  category: InventoryCategory;
  unit: InventoryUnit;
  reorder_threshold: number;
  par_level: number | null;
  is_active: boolean | null;
  organization_id: string;
  created_at: string | null;
  total_stock?: number;
  location_name?: string;
}

export interface InventoryItemFormData {
  name: string;
  description?: string;
  notes?: string;
  expiration_date?: string | null;
  category: InventoryCategory;
  unit: InventoryUnit;
  reorder_threshold: number;
  par_level?: number | null;
}

export interface StockRecord {
  id: string;
  item_id: string;
  location_id: string;
  technician_id: string | null;
  quantity: number;
  last_counted: string | null;
  location?: { id: string; name: string } | null;
  technician?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  location_id: string;
  type: 'restock' | 'usage' | 'transfer' | 'adjustment' | 'count';
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
  location?: { id: string; name: string } | null;
  creator?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export function useInventoryItems(filters?: { category?: string | null; search?: string | null }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['inventory-items', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // First get items
      let query = supabase
        .from('inventory_items')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('name');

      if (filters?.category && ['cleaning_solution', 'supply', 'consumable'].includes(filters.category)) {
        query = query.eq('category', filters.category as 'cleaning_solution' | 'supply' | 'consumable');
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data: items, error } = await query;
      if (error) throw error;

      // Get stock totals for all items
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_stock')
        .select('item_id, quantity')
        .is('deleted_at', null);

      if (stockError) throw stockError;

      // Calculate totals per item
      const stockTotals = stockData.reduce((acc: Record<string, number>, stock) => {
        acc[stock.item_id] = (acc[stock.item_id] || 0) + Number(stock.quantity);
        return acc;
      }, {});

      return items.map(item => ({
        ...item,
        total_stock: stockTotals[item.id] || 0,
      })) as InventoryItem[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useInventoryItem(itemId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['inventory-item', itemId],
    queryFn: async () => {
      if (!itemId) return null;

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      return data as InventoryItem | null;
    },
    enabled: !!itemId && !!profile?.organization_id,
  });
}

export function useItemStock(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item-stock', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          id,
          item_id,
          location_id,
          technician_id,
          quantity,
          last_counted,
          locations:location_id (id, name),
          profiles:technician_id (id, first_name, last_name)
        `)
        .eq('item_id', itemId)
        .is('deleted_at', null);

      if (error) throw error;

      return data.map((stock: any) => ({
        ...stock,
        location: stock.locations,
        technician: stock.profiles,
      })) as StockRecord[];
    },
    enabled: !!itemId,
  });
}

export function useItemTransactions(itemId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['item-transactions', itemId, limit],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          id,
          item_id,
          location_id,
          type,
          quantity,
          quantity_before,
          quantity_after,
          notes,
          created_at,
          created_by,
          locations:location_id (id, name),
          profiles:created_by (id, first_name, last_name)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map((tx: any) => ({
        ...tx,
        location: tx.locations,
        creator: tx.profiles,
      })) as InventoryTransaction[];
    },
    enabled: !!itemId,
  });
}

export function useUsageTrend(itemId: string | undefined) {
  return useQuery({
    queryKey: ['usage-trend', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      // Get usage transactions from last 8 weeks
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('quantity, created_at')
        .eq('item_id', itemId)
        .eq('type', 'usage')
        .gte('created_at', eightWeeksAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by week
      const weeklyUsage: Record<string, number> = {};
      const now = new Date();

      // Initialize last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekKey = getWeekKey(weekStart);
        weeklyUsage[weekKey] = 0;
      }

      // Sum up usage per week
      data.forEach(tx => {
        const weekKey = getWeekKey(new Date(tx.created_at!));
        if (weeklyUsage[weekKey] !== undefined) {
          weeklyUsage[weekKey] += Math.abs(Number(tx.quantity));
        }
      });

      return Object.entries(weeklyUsage).map(([week, usage]) => ({
        week,
        usage,
      }));
    },
    enabled: !!itemId,
  });
}

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: InventoryItemFormData) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { data: newItem, error } = await supabase
        .from('inventory_items')
        .insert({
          ...data,
          organization_id: profile.organization_id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Item created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });
}

export interface BulkImportItem extends InventoryItemFormData {
  quantity?: number;
  location_id?: string;
}

export function useBulkCreateInventoryItems() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (items: BulkImportItem[]) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Get all existing items for this organization to match by name
      const { data: existingItems, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null);

      if (fetchError) throw fetchError;

      // Create a map of lowercase name -> item for case-insensitive matching
      const existingByName = new Map<string, { id: string; name: string }>();
      existingItems?.forEach(item => {
        existingByName.set(item.name.toLowerCase().trim(), item);
      });

      const itemsToCreate: BulkImportItem[] = [];
      const itemsToUpdate: Array<{ existingId: string; importItem: BulkImportItem }> = [];

      // Separate items into create vs update
      items.forEach(item => {
        const existing = existingByName.get(item.name.toLowerCase().trim());
        if (existing) {
          itemsToUpdate.push({ existingId: existing.id, importItem: item });
        } else {
          itemsToCreate.push(item);
        }
      });

      let createdCount = 0;
      let updatedCount = 0;

      // Create new items
      if (itemsToCreate.length > 0) {
        const newItemsData = itemsToCreate.map(item => ({
          name: item.name,
          description: item.description,
          notes: item.notes,
          expiration_date: item.expiration_date,
          category: item.category,
          unit: item.unit,
          reorder_threshold: item.reorder_threshold,
          par_level: item.par_level,
          organization_id: profile.organization_id,
          is_active: true,
        }));

        const { data: createdItems, error } = await supabase
          .from('inventory_items')
          .insert(newItemsData)
          .select();

        if (error) throw error;
        createdCount = createdItems?.length || 0;

        // Create stock records for new items
        const stockRecords: Array<{
          item_id: string;
          location_id: string;
          quantity: number;
          technician_id: null;
        }> = [];

        createdItems?.forEach((createdItem, index) => {
          const originalItem = itemsToCreate[index];
          if (originalItem.quantity && originalItem.quantity > 0 && originalItem.location_id) {
            stockRecords.push({
              item_id: createdItem.id,
              location_id: originalItem.location_id,
              quantity: originalItem.quantity,
              technician_id: null,
            });
          }
        });

        if (stockRecords.length > 0) {
          await supabase.from('inventory_stock').insert(stockRecords);
        }
      }

      // Update existing items' stock
      for (const { existingId, importItem } of itemsToUpdate) {
        if (importItem.quantity && importItem.quantity > 0 && importItem.location_id) {
          // Check if stock record exists for this item + location
          const { data: existingStock } = await supabase
            .from('inventory_stock')
            .select('id, quantity')
            .eq('item_id', existingId)
            .eq('location_id', importItem.location_id)
            .is('technician_id', null)
            .is('deleted_at', null)
            .maybeSingle();

          if (existingStock) {
            // Update existing stock - add to current quantity
            await supabase
              .from('inventory_stock')
              .update({ 
                quantity: existingStock.quantity + importItem.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingStock.id);
          } else {
            // Create new stock record for existing item
            await supabase.from('inventory_stock').insert({
              item_id: existingId,
              location_id: importItem.location_id,
              quantity: importItem.quantity,
              technician_id: null,
            });
          }
          updatedCount++;
        }
      }

      return { createdCount, updatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['item-stock'] });
      
      const messages: string[] = [];
      if (result.createdCount > 0) messages.push(`${result.createdCount} created`);
      if (result.updatedCount > 0) messages.push(`${result.updatedCount} updated`);
      toast.success(`Successfully imported: ${messages.join(', ')}`);
    },
    onError: (error) => {
      toast.error(`Failed to import items: ${error.message}`);
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItemFormData> }) => {
      const { data: updatedItem, error } = await supabase
        .from('inventory_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item'] });
      toast.success('Item updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

export function useBulkUpdateInventoryItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      ids, 
      updates 
    }: { 
      ids: string[]; 
      updates: Partial<InventoryItemFormData>; 
    }) => {
      const { error } = await supabase
        .from('inventory_items')
        .update(updates)
        .in('id', ids);

      if (error) throw error;
      return { updatedCount: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item'] });
      toast.success(`Successfully updated ${result.updatedCount} item${result.updatedCount !== 1 ? 's' : ''}`);
    },
    onError: (error) => {
      toast.error(`Failed to update items: ${error.message}`);
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      locationId, 
      technicianId, 
      newQuantity, 
      notes 
    }: { 
      itemId: string; 
      locationId: string; 
      technicianId?: string | null;
      newQuantity: number; 
      notes?: string;
    }) => {
      // Get current stock record
      let stockQuery = supabase
        .from('inventory_stock')
        .select('*')
        .eq('item_id', itemId)
        .eq('location_id', locationId)
        .is('deleted_at', null);

      if (technicianId) {
        stockQuery = stockQuery.eq('technician_id', technicianId);
      } else {
        stockQuery = stockQuery.is('technician_id', null);
      }

      const { data: existingStock } = await stockQuery.maybeSingle();

      const oldQuantity = existingStock?.quantity ?? 0;
      const quantityDiff = newQuantity - Number(oldQuantity);

      if (existingStock) {
        // Update existing stock
        const { error: updateError } = await supabase
          .from('inventory_stock')
          .update({ 
            quantity: newQuantity, 
            last_counted: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id);

        if (updateError) throw updateError;
      } else {
        // Create new stock record
        const { error: insertError } = await supabase
          .from('inventory_stock')
          .insert({
            item_id: itemId,
            location_id: locationId,
            technician_id: technicianId || null,
            quantity: newQuantity,
            last_counted: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      // Create transaction record
      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
          item_id: itemId,
          location_id: locationId,
          technician_id: technicianId || null,
          type: 'adjustment',
          quantity: quantityDiff,
          quantity_before: oldQuantity,
          quantity_after: newQuantity,
          notes,
          created_by: profile?.id,
        });

      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-stock'] });
      queryClient.invalidateQueries({ queryKey: ['item-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success('Stock adjusted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to adjust stock: ${error.message}`);
    },
  });
}
