import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChecklistTemplate,
  ChecklistItem,
  useCreateTemplate,
  useUpdateTemplate,
} from "@/hooks/useChecklists";
import { Plus, Trash2, GripVertical, Camera, Type, Hash, List, CheckSquare } from "lucide-react";

const itemTypeIcons = {
  boolean: CheckSquare,
  text: Type,
  number: Hash,
  select: List,
  photo: Camera,
};

const itemTypeLabels = {
  boolean: "Checkbox",
  text: "Text Input",
  number: "Number",
  select: "Dropdown",
  photo: "Photo Upload",
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekly"]),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ChecklistTemplate | null;
}

export function TemplateFormDialog({ open, onOpenChange, template }: TemplateFormDialogProps) {
  const isEditing = !!template;
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemType, setNewItemType] = useState<ChecklistItem["type"]>("boolean");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      frequency: "daily",
      is_active: true,
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        frequency: template.frequency,
        is_active: template.is_active,
      });
      setItems(template.items_json || []);
    } else {
      form.reset({
        name: "",
        description: "",
        frequency: "daily",
        is_active: true,
      });
      setItems([]);
    }
  }, [template, form]);

  const handleAddItem = () => {
    const key = `item_${Date.now()}`;
    const newItem: ChecklistItem = {
      key,
      label: "",
      type: newItemType,
      required: true,
      photo_required: newItemType === "boolean" ? false : undefined,
      options: newItemType === "select" ? ["Option 1", "Option 2"] : undefined,
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (index: number, updates: Partial<ChecklistItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleMoveItem = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const handleUpdateOption = (itemIndex: number, optionIndex: number, value: string) => {
    const updated = [...items];
    const options = [...(updated[itemIndex].options || [])];
    options[optionIndex] = value;
    updated[itemIndex] = { ...updated[itemIndex], options };
    setItems(updated);
  };

  const handleAddOption = (itemIndex: number) => {
    const updated = [...items];
    const options = [...(updated[itemIndex].options || []), `Option ${(updated[itemIndex].options?.length || 0) + 1}`];
    updated[itemIndex] = { ...updated[itemIndex], options };
    setItems(updated);
  };

  const handleRemoveOption = (itemIndex: number, optionIndex: number) => {
    const updated = [...items];
    const options = (updated[itemIndex].options || []).filter((_, i) => i !== optionIndex);
    updated[itemIndex] = { ...updated[itemIndex], options };
    setItems(updated);
  };

  const onSubmit = async (values: FormValues) => {
    // Validate items
    const validItems = items.filter((item) => item.label.trim() !== "");
    if (validItems.length === 0) {
      form.setError("root", { message: "At least one checklist item is required" });
      return;
    }

    const templateData = {
      name: values.name,
      description: values.description || "",
      frequency: values.frequency,
      items: validItems,
      is_active: values.is_active,
    };

    if (isEditing && template) {
      await updateTemplate.mutateAsync({ id: template.id, data: templateData });
    } else {
      await createTemplate.mutateAsync(templateData);
    }

    onOpenChange(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the checklist template and its items."
              : "Create a new checklist template with custom items."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form id="template-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Daily Vehicle Inspection" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this checklist..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Active</FormLabel>
                        </div>
                        <FormDescription>
                          Inactive templates won't appear for technicians.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Checklist Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Checklist Items</h3>
                    <p className="text-sm text-muted-foreground">
                      Add items that technicians will complete.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={newItemType}
                      onValueChange={(v) => setNewItemType(v as ChecklistItem["type"])}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(itemTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={handleAddItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    No items yet. Add your first checklist item above.
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {items.map((item, index) => {
                      const Icon = itemTypeIcons[item.type];
                      return (
                        <AccordionItem
                          key={item.key}
                          value={item.key}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 flex-1 text-left">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="gap-1">
                                <Icon className="h-3 w-3" />
                                {itemTypeLabels[item.type]}
                              </Badge>
                              <span className="truncate">
                                {item.label || <span className="text-muted-foreground italic">Untitled</span>}
                              </span>
                              {item.required && (
                                <Badge variant="secondary" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 space-y-4">
                            <div className="grid gap-4">
                              <div>
                                <label className="text-sm font-medium">Label</label>
                                <Input
                                  value={item.label}
                                  onChange={(e) =>
                                    handleUpdateItem(index, { label: e.target.value })
                                  }
                                  placeholder="e.g., Check tire pressure"
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium">Description (optional)</label>
                                <Input
                                  value={item.description || ""}
                                  onChange={(e) =>
                                    handleUpdateItem(index, { description: e.target.value })
                                  }
                                  placeholder="Additional instructions..."
                                  className="mt-1"
                                />
                              </div>

                              {item.type === "select" && (
                                <div>
                                  <label className="text-sm font-medium">Options</label>
                                  <div className="mt-1 space-y-2">
                                    {(item.options || []).map((option, optIndex) => (
                                      <div key={optIndex} className="flex items-center gap-2">
                                        <Input
                                          value={option}
                                          onChange={(e) =>
                                            handleUpdateOption(index, optIndex, e.target.value)
                                          }
                                          placeholder={`Option ${optIndex + 1}`}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemoveOption(index, optIndex)}
                                          disabled={(item.options?.length || 0) <= 2}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAddOption(index)}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Option
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={item.required}
                                    onCheckedChange={(checked) =>
                                      handleUpdateItem(index, { required: checked })
                                    }
                                  />
                                  <label className="text-sm">Required</label>
                                </div>

                                {item.type === "boolean" && (
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={item.photo_required}
                                      onCheckedChange={(checked) =>
                                        handleUpdateItem(index, { photo_required: checked })
                                      }
                                    />
                                    <label className="text-sm">Photo Required</label>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMoveItem(index, "up")}
                                    disabled={index === 0}
                                  >
                                    Move Up
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMoveItem(index, "down")}
                                    disabled={index === items.length - 1}
                                  >
                                    Move Down
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}

                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" disabled={isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
