import { StockRecord } from "@/hooks/useInventory";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface StockBreakdownTableProps {
  stocks: StockRecord[];
  unit: string;
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

export function StockBreakdownTable({ stocks, unit, isLoading }: StockBreakdownTableProps) {
  const totalStock = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
  const unitLabel = unitLabels[unit] ?? unit;

  const getAssignedTo = (stock: StockRecord) => {
    if (stock.technician) {
      const name = [stock.technician.first_name, stock.technician.last_name]
        .filter(Boolean)
        .join(' ');
      return name || 'Unknown Technician';
    }
    return 'Storage';
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
        ))}
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">No stock records found</p>
        <p className="text-sm text-muted-foreground">
          Use "Adjust Stock" to add stock to locations
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Location</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Last Counted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => (
            <TableRow key={stock.id}>
              <TableCell className="font-medium">
                {stock.location?.name ?? 'Unknown Location'}
              </TableCell>
              <TableCell>
                <Badge variant={stock.technician ? 'secondary' : 'outline'}>
                  {getAssignedTo(stock)}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {stock.quantity} {unitLabel}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {stock.last_counted 
                  ? format(new Date(stock.last_counted), 'MMM d, yyyy h:mm a')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
          {/* Total Row */}
          <TableRow className="bg-muted/50 font-medium">
            <TableCell colSpan={2}>Total Stock</TableCell>
            <TableCell className="text-right">
              {totalStock} {unitLabel}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
