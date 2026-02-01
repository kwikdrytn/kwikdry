import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocations } from "@/hooks/useLocations";
import { 
  useTechniciansByLocation, 
  useUpdateEquipment,
  Equipment 
} from "@/hooks/useEquipment";

const formSchema = z.object({
  location_id: z.string().nullable(),
  assigned_to: z.string().nullable(),
});

interface ReassignEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

export function ReassignEquipmentDialog({
  open,
  onOpenChange,
  equipment,
}: ReassignEquipmentDialogProps) {
  const { data: locations = [] } = useLocations();
  const updateEquipment = useUpdateEquipment();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location_id: null,
      assigned_to: null,
    },
  });

  const selectedLocationId = form.watch("location_id");
  
  const { data: technicians = [] } = useTechniciansByLocation(
    selectedLocationId === "none" ? null : selectedLocationId
  );

  useEffect(() => {
    if (equipment) {
      form.reset({
        location_id: equipment.location_id,
        assigned_to: equipment.assigned_to,
      });
    }
  }, [equipment, form]);

  // Clear assigned_to when location changes
  useEffect(() => {
    const currentAssignedTo = form.getValues("assigned_to");
    if (currentAssignedTo && currentAssignedTo !== "none") {
      const techExists = technicians.some(t => t.id === currentAssignedTo);
      if (!techExists) {
        form.setValue("assigned_to", null);
      }
    }
  }, [selectedLocationId, technicians, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (!equipment) return;
    
    updateEquipment.mutate(
      { 
        id: equipment.id, 
        data: {
          location_id: values.location_id === "none" ? null : values.location_id,
          assigned_to: values.assigned_to === "none" ? null : values.assigned_to,
        }
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Equipment</DialogTitle>
          <DialogDescription>
            Change the location and technician assignment for {equipment?.name}
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
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Location</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
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
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {technicians.length === 0 && selectedLocationId && selectedLocationId !== "none" ? (
                        <SelectItem value="no-techs" disabled>
                          No technicians at this location
                        </SelectItem>
                      ) : (
                        technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.first_name} {tech.last_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateEquipment.isPending}>
                {updateEquipment.isPending ? 'Saving...' : 'Save Assignment'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
