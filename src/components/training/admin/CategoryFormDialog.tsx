import { useState, useEffect } from "react";
import { Loader2, Wrench, Sparkles, Shield, Users, ClipboardList, Video, BookOpen, Lightbulb, Target, Award, GraduationCap, Folder, LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  TrainingCategoryAdmin,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/useAdminTraining";

// Available icon options with their components
const ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Wrench", label: "Wrench", icon: Wrench },
  { value: "Sparkles", label: "Sparkles", icon: Sparkles },
  { value: "Shield", label: "Shield", icon: Shield },
  { value: "Users", label: "Users", icon: Users },
  { value: "ClipboardList", label: "Clipboard List", icon: ClipboardList },
  { value: "Video", label: "Video", icon: Video },
  { value: "BookOpen", label: "Book Open", icon: BookOpen },
  { value: "Lightbulb", label: "Lightbulb", icon: Lightbulb },
  { value: "Target", label: "Target", icon: Target },
  { value: "Award", label: "Award", icon: Award },
  { value: "GraduationCap", label: "Graduation Cap", icon: GraduationCap },
  { value: "Folder", label: "Folder", icon: Folder },
];

export function getIconComponent(iconName: string | null): LucideIcon {
  const found = ICON_OPTIONS.find(opt => opt.value === iconName);
  return found?.icon || Folder;
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: TrainingCategoryAdmin | null;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const { toast } = useToast();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const isEditing = !!category;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Folder");

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setDescription(category.description || "");
        setIcon(category.icon || "Folder");
      } else {
        resetForm();
      }
    }
  }, [open, category]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("Folder");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a category name.",
        variant: "destructive",
      });
      return;
    }

    const formData = {
      name: name.trim(),
      description: description.trim() || null,
      icon,
    };

    try {
      if (isEditing && category) {
        await updateCategory.mutateAsync({ id: category.id, data: formData });
        toast({ title: "Category updated successfully" });
      } else {
        await createCategory.mutateAsync(formData);
        toast({ title: "Category created successfully" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save category. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!category) return;

    try {
      await deleteCategory.mutateAsync(category.id);
      toast({ title: "Category deleted successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending || deleteCategory.isPending;

  const IconPreview = getIconComponent(icon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this category"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md border bg-muted flex items-center justify-center">
                <IconPreview className="h-5 w-5" />
              </div>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isPending} className="sm:mr-auto">
                  Delete Category
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {category && category.video_count > 0 ? (
                      <>
                        This category has <strong>{category.video_count} video{category.video_count !== 1 ? "s" : ""}</strong>. 
                        They will become uncategorized.
                      </>
                    ) : (
                      "This will permanently delete this category."
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
