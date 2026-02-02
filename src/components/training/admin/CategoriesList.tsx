import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrainingCategoryAdmin, useReorderCategories } from "@/hooks/useAdminTraining";
import { getIconComponent } from "./CategoryFormDialog";

interface CategoriesListProps {
  categories: TrainingCategoryAdmin[];
  onEdit: (category: TrainingCategoryAdmin) => void;
  isLoading?: boolean;
}

interface SortableItemProps {
  category: TrainingCategoryAdmin;
  onEdit: (category: TrainingCategoryAdmin) => void;
}

function SortableItem({ category, onEdit }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getIconComponent(category.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 bg-card border rounded-lg group"
    >
      <button
        className="cursor-grab p-1 rounded hover:bg-muted touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium">{category.name}</div>
        {category.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {category.description}
          </p>
        )}
      </div>

      <Badge variant="secondary" className="shrink-0">
        {category.video_count} video{category.video_count !== 1 ? "s" : ""}
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(category)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CategoriesList({ categories, onEdit, isLoading }: CategoriesListProps) {
  const reorderCategories = useReorderCategories();
  const [items, setItems] = useState<TrainingCategoryAdmin[]>(categories);

  // Sync items when categories change
  useMemo(() => {
    setItems(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Update sort_order in database
      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index + 1,
      }));
      reorderCategories.mutate(updates);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No categories yet</h3>
        <p className="text-muted-foreground">
          Create categories to organize your training videos.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((category) => (
            <SortableItem
              key={category.id}
              category={category}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
