import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useLocations } from "@/hooks/useUsers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  location_id: z.string().min(1, "Location is required"),
  technician_id: z.string().nullable(),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or greater"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  onSubmit: (data: {
    itemId: string;
    locationId: string;
    technicianId: string | null;
    newQuantity: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  onSubmit,
  isLoading,
}: StockAdjustDialogProps) {
  const { data: locations = [] } = useLocations();
  const { profile } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Fetch technicians for selected location
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', profile?.organization_id, selectedLocationId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null);

      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location_id: '',
      technician_id: null,
      quantity: 0,
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        location_id: '',
        technician_id: null,
        quantity: 0,
        notes: '',
      });
      setSelectedLocationId('');
    }
  }, [open, form]);

  const handleLocationChange = (locationId: string) => {
    setSelectedLocationId(locationId);
    form.setValue('location_id', locationId);
    form.setValue('technician_id', null);
  };

  const handleSubmit = (data: FormData) => {
    onSubmit({
      itemId,
      locationId: data.location_id,
      technicianId: data.technician_id === 'storage' ? null : data.technician_id,
      newQuantity: data.quantity,
      notes: data.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-background">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Set stock level for <strong>{itemName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select 
                    onValueChange={handleLocationChange} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover">
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="technician_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value ?? 'storage'}
                    disabled={!selectedLocationId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignment" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover">
                      <SelectItem value="storage">Storage (Location)</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {[tech.first_name, tech.last_name].filter(Boolean).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Reason for adjustment..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adjust Stock
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
