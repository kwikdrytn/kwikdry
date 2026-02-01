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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { InventoryItem, InventoryItemFormData } from "@/hooks/useInventory";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  expiration_date: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or greater").optional(),
  unit: z.enum(['gallon', 'oz', 'liter', 'ml', 'each', 'box', 'case', 'roll', 'bag']),
  notes: z.string().optional(),
  // Keep these for backwards compatibility but hide from form
  category: z.enum(['cleaning_solution', 'supply', 'consumable']).default('supply'),
  reorder_threshold: z.coerce.number().min(0).default(0),
  par_level: z.coerce.number().min(0).optional().nullable(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem | null;
  onSubmit: (data: InventoryItemFormData) => void;
  isLoading?: boolean;
}

const unitOptions = [
  { value: 'gallon', label: 'Gallon' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'liter', label: 'Liter' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'each', label: 'Each' },
  { value: 'box', label: 'Box' },
  { value: 'case', label: 'Case' },
  { value: 'roll', label: 'Roll' },
  { value: 'bag', label: 'Bag' },
];

export function InventoryFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
}: InventoryFormDialogProps) {
  const isEditing = !!item;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      expiration_date: null,
      quantity: 0,
      unit: 'each',
      notes: '',
      category: 'supply',
      reorder_threshold: 0,
      par_level: null,
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (item) {
        form.reset({
          name: item.name,
          expiration_date: item.expiration_date ?? null,
          quantity: item.total_stock ?? 0,
          unit: item.unit,
          notes: item.notes ?? '',
          category: item.category,
          reorder_threshold: item.reorder_threshold,
          par_level: item.par_level,
          description: item.description ?? '',
        });
      } else {
        form.reset({
          name: '',
          expiration_date: null,
          quantity: 0,
          unit: 'each',
          notes: '',
          category: 'supply',
          reorder_threshold: 0,
          par_level: null,
          description: '',
        });
      }
    }
  }, [open, item, form]);

  const handleSubmit = (data: FormValues) => {
    onSubmit({
      name: data.name,
      expiration_date: data.expiration_date || null,
      unit: data.unit,
      notes: data.notes,
      category: data.category,
      reorder_threshold: data.reorder_threshold,
      par_level: data.par_level,
      description: data.description,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the inventory item details.'
              : 'Add a new item to your inventory.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col min-h-0 flex-1">
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 pr-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiration_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            placeholder="0" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover">
                            {unitOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any notes about this item" 
                          {...field} 
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4 mt-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
