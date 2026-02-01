import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, Pencil, Settings2 } from "lucide-react";
import { StockBreakdownTable } from "@/components/inventory/StockBreakdownTable";
import { StockAdjustDialog } from "@/components/inventory/StockAdjustDialog";
import { TransactionHistory } from "@/components/inventory/TransactionHistory";
import { UsageTrendChart } from "@/components/inventory/UsageTrendChart";
import { InventoryFormDialog } from "@/components/inventory/InventoryFormDialog";
import {
  useInventoryItem,
  useItemStock,
  useItemTransactions,
  useUsageTrend,
  useUpdateInventoryItem,
  useAdjustStock,
  InventoryItemFormData,
} from "@/hooks/useInventory";
import { cn } from "@/lib/utils";

const categoryLabels: Record<string, string> = {
  cleaning_solution: 'Cleaning Solution',
  supply: 'Supply',
  consumable: 'Consumable',
};

const unitLabels: Record<string, string> = {
  gallon: 'Gallon',
  oz: 'Ounce',
  liter: 'Liter',
  ml: 'Milliliter',
  each: 'Each',
  box: 'Box',
  case: 'Case',
  roll: 'Roll',
  bag: 'Bag',
};

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  const { data: item, isLoading: itemLoading } = useInventoryItem(id);
  const { data: stocks = [], isLoading: stocksLoading } = useItemStock(id);
  const { data: transactions = [], isLoading: txLoading } = useItemTransactions(id);
  const { data: usageTrend = [], isLoading: trendLoading } = useUsageTrend(id);

  const updateItem = useUpdateInventoryItem();
  const adjustStock = useAdjustStock();

  const totalStock = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
  const isLow = item ? totalStock <= item.reorder_threshold : false;

  const handleUpdateItem = (data: InventoryItemFormData) => {
    if (!id) return;
    updateItem.mutate(
      { id, data },
      { onSuccess: () => setIsEditOpen(false) }
    );
  };

  const handleAdjustStock = (data: {
    itemId: string;
    locationId: string;
    technicianId: string | null;
    newQuantity: number;
    notes?: string;
  }) => {
    adjustStock.mutate(data, {
      onSuccess: () => setIsAdjustOpen(false),
    });
  };

  if (itemLoading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout title="Item Not Found">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">This inventory item doesn't exist.</p>
          <Button onClick={() => navigate('/admin/inventory')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={item.name}>
      <div className="space-y-6">
        {/* Back Button & Actions */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin/inventory')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit Item
            </Button>
            <Button onClick={() => setIsAdjustOpen(true)} className="gap-2">
              <Settings2 className="h-4 w-4" />
              Adjust Stock
            </Button>
          </div>
        </div>

        {/* Item Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{item.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline">{categoryLabels[item.category]}</Badge>
                    <Badge variant="secondary">{unitLabels[item.unit]}</Badge>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className={cn(
                          "h-2 w-2 rounded-full",
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
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground mt-2">{item.description}</p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Stock</p>
                <p className="text-3xl font-bold">{totalStock}</p>
                <p className="text-sm text-muted-foreground">
                  Reorder at: {item.reorder_threshold}
                  {item.par_level && ` · Par: ${item.par_level}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Breakdown & Chart */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock by Location</CardTitle>
              <CardDescription>Current stock levels across all locations</CardDescription>
            </CardHeader>
            <CardContent>
              <StockBreakdownTable 
                stocks={stocks} 
                unit={item.unit}
                isLoading={stocksLoading} 
              />
            </CardContent>
          </Card>

          <UsageTrendChart data={usageTrend} isLoading={trendLoading} />
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <CardDescription>Last 20 stock changes</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionHistory transactions={transactions} isLoading={txLoading} />
          </CardContent>
        </Card>
      </div>

      <InventoryFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        item={item}
        onSubmit={handleUpdateItem}
        isLoading={updateItem.isPending}
      />

      <StockAdjustDialog
        open={isAdjustOpen}
        onOpenChange={setIsAdjustOpen}
        itemId={item.id}
        itemName={item.name}
        onSubmit={handleAdjustStock}
        isLoading={adjustStock.isPending}
      />
    </DashboardLayout>
  );
}
