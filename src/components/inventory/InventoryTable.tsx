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
import { differenceInDays, parseISO, format } from "date-fns";

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading: boolean;
}

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

function getDaysLeft(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  try {
    const expDate = parseISO(expirationDate);
    return differenceInDays(expDate, new Date());
  } catch {
    return null;
  }
}

function getDaysLeftBadge(daysLeft: number | null) {
  if (daysLeft === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  
  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="font-medium">
        Expired
      </Badge>
    );
  }
  
  if (daysLeft <= 7) {
    return (
      <Badge variant="destructive" className="font-medium">
        {daysLeft} days
      </Badge>
    );
  }
  
  if (daysLeft <= 30) {
    return (
      <Badge variant="secondary" className="font-medium text-warning">
        {daysLeft} days
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="font-medium">
      {daysLeft} days
    </Badge>
  );
}

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
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Product Name</TableHead>
            <TableHead>Expiration Date</TableHead>
            <TableHead>Days Left</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="min-w-[150px]">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const daysLeft = getDaysLeft(item.expiration_date);
            
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/inventory/${item.id}`)}
              >
                <TableCell>
                  <p className="font-medium">{item.name}</p>
                </TableCell>
                <TableCell>
                  {item.expiration_date ? (
                    <span className="text-sm">
                      {format(parseISO(item.expiration_date), 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {getDaysLeftBadge(daysLeft)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.total_stock ?? 0}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {unitLabels[item.unit] ?? item.unit}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.notes ? (
                    <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                      {item.notes}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
