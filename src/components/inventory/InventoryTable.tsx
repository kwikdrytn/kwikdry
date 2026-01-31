import { useNavigate } from "react-router-dom";
import { InventoryItem } from "@/hooks/useInventory";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading: boolean;
}

const categoryLabels: Record<string, string> = {
  cleaning_solution: 'Cleaning Solution',
  supply: 'Supply',
  consumable: 'Consumable',
};

const unitLabels: Record<string, string> = {
  gallon: 'gal',
  oz: 'oz',
  liter: 'L',
  ml: 'ml',
  each: 'ea',
  box: 'box',
  case: 'case',
  roll: 'roll',
  bag: 'bag',
};

export function InventoryTable({ items, isLoading }: InventoryTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[100px]" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No inventory items found</p>
        <p className="text-sm text-muted-foreground">
          Add your first item to get started
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Current Stock</TableHead>
            <TableHead className="text-right">Reorder At</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isLow = (item.total_stock ?? 0) <= item.reorder_threshold;
            
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/admin/inventory/${item.id}`)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {categoryLabels[item.category] ?? item.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.total_stock ?? 0} {unitLabels[item.unit] ?? item.unit}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.reorder_threshold} {unitLabels[item.unit] ?? item.unit}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div 
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        isLow ? "bg-destructive" : "bg-primary"
                      )}
                    />
                    <span className={cn(
                      "text-sm font-medium",
                      isLow ? "text-destructive" : "text-primary"
                    )}>
                      {isLow ? "Low Stock" : "In Stock"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
