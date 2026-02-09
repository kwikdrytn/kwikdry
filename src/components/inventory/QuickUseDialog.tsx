import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Minus, Package } from "lucide-react";
import { InventoryItem } from "@/hooks/useInventory";
import { useRecordUsage } from "@/hooks/useRecordUsage";
import { cn } from "@/lib/utils";

interface QuickUseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
}

export function QuickUseDialog({ open, onOpenChange, items }: QuickUseDialogProps) {
  const [search, setSearch] = useState("");
  const recordUsage = useRecordUsage();

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(lower));
  }, [items, search]);

  const handleUse = (item: InventoryItem) => {
    recordUsage.mutate(
      { itemId: item.id, itemName: item.name },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5 text-primary" />
            Use a Product
          </DialogTitle>
          <DialogDescription>
            Select the product you used — stock will be reduced by 1.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1 min-h-0 max-h-[50vh]">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No products found</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const stock = item.total_stock ?? 0;
              const isLow = stock <= item.reorder_threshold;
              const isEmpty = stock <= 0;

              return (
                <button
                  key={item.id}
                  onClick={() => handleUse(item)}
                  disabled={isEmpty || recordUsage.isPending}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    "hover:bg-accent hover:border-primary/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {item.category.replace("_", " ")} · {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge
                      variant={isEmpty ? "destructive" : isLow ? "secondary" : "outline"}
                      className={cn(
                        "text-xs tabular-nums",
                        isLow && !isEmpty && "bg-warning/10 text-warning border-warning/30"
                      )}
                    >
                      {stock} left
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
