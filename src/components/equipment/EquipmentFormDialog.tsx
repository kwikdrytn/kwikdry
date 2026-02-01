import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocations } from "@/hooks/useLocations";
import { 
  useTechniciansByLocation, 
  useCheckSerialNumber,
  Equipment, 
  EquipmentFormData, 
  EquipmentStatus 
} from "@/hooks/useEquipment";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  description: z.string().optional(),
  serial_number: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'retired']),
  location_id: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_price: z.coerce.number().nullable().optional(),
  warranty_expiry: z.string().nullable().optional(),
  notes: z.string().optional(),
});

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment | null;
  onSubmit: (data: EquipmentFormData) => void;
  onDelete?: (id: string) => void;
  isLoading: boolean;
  isDeleting?: boolean;
}

const EQUIPMENT_TYPES = [
  { value: 'extractor', label: 'Extractor' },
  { value: 'wand', label: 'Wand' },
  { value: 'hose', label: 'Hose' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  onSubmit,
  onDelete,
  isLoading,
  isDeleting = false,
}: EquipmentFormDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { data: locations = [] } = useLocations();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'other',
      description: '',
      serial_number: '',
      model: '',
      manufacturer: '',
      status: 'active' as EquipmentStatus,
      location_id: null,
      assigned_to: null,
      purchase_date: null,
      purchase_price: null,
      warranty_expiry: null,
      notes: '',
    },
  });

  const selectedLocationId = form.watch("location_id");
  const serialNumber = form.watch("serial_number");
  
  // Get technicians filtered by selected location
  const { data: technicians = [] } = useTechniciansByLocation(
    selectedLocationId === "none" ? null : selectedLocationId
  );
  
  // Check for duplicate serial number
  const { data: serialNumberCheck } = useCheckSerialNumber(
    serialNumber || null,
    equipment?.id || null
  );

  useEffect(() => {
    if (equipment) {
      form.reset({
        name: equipment.name,
        type: equipment.type,
        description: equipment.description || '',
        serial_number: equipment.serial_number || '',
        model: equipment.model || '',
        manufacturer: equipment.manufacturer || '',
        status: equipment.status,
        location_id: equipment.location_id,
        assigned_to: equipment.assigned_to,
        purchase_date: equipment.purchase_date,
        purchase_price: equipment.purchase_price,
        warranty_expiry: equipment.warranty_expiry,
        notes: equipment.notes || '',
      });
    } else {
      form.reset({
        name: '',
        type: 'other',
        description: '',
        serial_number: '',
        model: '',
        manufacturer: '',
        status: 'active',
        location_id: null,
        assigned_to: null,
        purchase_date: null,
        purchase_price: null,
        warranty_expiry: null,
        notes: '',
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
    onSubmit({
      ...values,
      location_id: values.location_id === "none" ? null : values.location_id,
      assigned_to: values.assigned_to === "none" ? null : values.assigned_to,
    } as EquipmentFormData);
  };

  const handleDelete = () => {
    if (equipment && onDelete) {
      onDelete(equipment.id);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{equipment ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
            <DialogDescription>
              {equipment ? 'Update the equipment details below.' : 'Enter the details for the new equipment.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter equipment name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serial_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter serial number" {...field} />
                      </FormControl>
                      {serialNumberCheck?.isDuplicate && (
                        <Alert variant="destructive" className="py-2 mt-1">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            This serial number already exists for "{serialNumberCheck.existingName}"
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter manufacturer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter model" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          value={field.value ?? ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warranty_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty Expiry</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter description" rows={2} {...field} />
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter any additional notes" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between pt-4">
                <div>
                  {equipment && onDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : equipment ? 'Update Equipment' : 'Add Equipment'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{equipment?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
