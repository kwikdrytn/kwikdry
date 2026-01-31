import { InventoryTransaction } from "@/hooks/useInventory";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  transactions: InventoryTransaction[];
  isLoading: boolean;
}

const typeLabels: Record<string, string> = {
  restock: 'Restock',
  usage: 'Usage',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  count: 'Count',
};

const typeVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  restock: 'default',
  usage: 'destructive',
  transfer: 'secondary',
  adjustment: 'outline',
  count: 'outline',
};

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">After</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isPositive = tx.quantity > 0;
            
            return (
              <TableRow key={tx.id}>
                <TableCell className="text-muted-foreground">
                  {tx.created_at 
                    ? format(new Date(tx.created_at), 'MMM d, h:mm a')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={typeVariants[tx.type] ?? 'outline'}>
                    {typeLabels[tx.type] ?? tx.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tx.location?.name ?? '—'}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-medium",
                  isPositive ? "text-primary" : "text-destructive"
                )}>
                  {isPositive ? '+' : ''}{tx.quantity}
                </TableCell>
                <TableCell className="text-right">
                  {tx.quantity_after ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tx.creator 
                    ? [tx.creator.first_name, tx.creator.last_name].filter(Boolean).join(' ')
                    : '—'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {tx.notes ?? '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
