import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useRecordUsage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, itemName }: { itemId: string; itemName: string }) => {
      if (!profile?.id || !profile?.location_id) {
        throw new Error("You must be assigned to a location to record usage.");
      }

      const technicianId = profile.id;
      const locationId = profile.location_id;

      // Find the tech's stock record for this item
      const { data: stockRecord } = await supabase
        .from("inventory_stock")
        .select("id, quantity")
        .eq("item_id", itemId)
        .eq("location_id", locationId)
        .eq("technician_id", technicianId)
        .is("deleted_at", null)
        .maybeSingle();

      // Also check location-level stock (no technician) as fallback
      let targetStock = stockRecord;
      let usedTechnicianId: string | null = technicianId;

      if (!targetStock || Number(targetStock.quantity) <= 0) {
        const { data: locationStock } = await supabase
          .from("inventory_stock")
          .select("id, quantity")
          .eq("item_id", itemId)
          .eq("location_id", locationId)
          .is("technician_id", null)
          .is("deleted_at", null)
          .maybeSingle();

        if (locationStock && Number(locationStock.quantity) > 0) {
          targetStock = locationStock;
          usedTechnicianId = null;
        }
      }

      if (!targetStock || Number(targetStock.quantity) <= 0) {
        throw new Error(`No stock available for ${itemName}.`);
      }

      const oldQuantity = Number(targetStock.quantity);
      const newQuantity = oldQuantity - 1;

      // Update the stock
      const { error: updateError } = await supabase
        .from("inventory_stock")
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetStock.id);

      if (updateError) throw updateError;

      // Record the transaction
      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          item_id: itemId,
          location_id: locationId,
          technician_id: usedTechnicianId,
          type: "usage" as const,
          quantity: -1,
          quantity_before: oldQuantity,
          quantity_after: newQuantity,
          notes: "Quick use: used 1 bottle",
          created_by: profile.id,
        });

      if (txError) throw txError;

      return { itemName, newQuantity };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["item-stock"] });
      queryClient.invalidateQueries({ queryKey: ["item-transactions"] });
      toast.success(`Used 1 ${result.itemName} — ${result.newQuantity} remaining`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
