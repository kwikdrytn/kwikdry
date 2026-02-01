import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Upload } from "lucide-react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { InventoryFormDialog } from "@/components/inventory/InventoryFormDialog";
import { CsvImportDialog, ParsedItem } from "@/components/inventory/CsvImportDialog";
import { 
  useInventoryItems, 
  useCreateInventoryItem,
  useBulkCreateInventoryItems,
  InventoryItemFormData 
} from "@/hooks/useInventory";
import { useDebounce } from "@/hooks/useDebounce";

export default function InventoryManagement() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  const debouncedSearch = useDebounce(search, 300);

  const { data: items = [], isLoading } = useInventoryItems({
    category: categoryFilter,
    search: debouncedSearch || null,
  });

  const createItem = useCreateInventoryItem();
  const bulkCreateItems = useBulkCreateInventoryItems();

  const handleCreateItem = (data: InventoryItemFormData) => {
    createItem.mutate(data, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  const handleImportItems = (items: ParsedItem[]) => {
    bulkCreateItems.mutate(items as InventoryItemFormData[], {
      onSuccess: () => setIsImportOpen(false),
    });
  };

  const lowStockCount = useMemo(() => 
    items.filter(item => (item.total_stock ?? 0) <= item.reorder_threshold).length,
    [items]
  );

  return (
    <DashboardLayout title="Inventory">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Items</CardDescription>
              <CardTitle className="text-3xl">{items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Low Stock Items</CardDescription>
              <CardTitle className="text-3xl text-destructive">{lowStockCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Stock Items</CardDescription>
              <CardTitle className="text-3xl text-primary">{items.length - lowStockCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Items
              </CardTitle>
              <CardDescription>
                Click an item to view details and manage stock
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <InventoryFilters
              search={search}
              category={categoryFilter}
              onSearchChange={setSearch}
              onCategoryChange={setCategoryFilter}
            />
            
            <InventoryTable
              items={items}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      <InventoryFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleCreateItem}
        isLoading={createItem.isPending}
      />

      <CsvImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImportItems}
        isLoading={bulkCreateItems.isPending}
      />
    </DashboardLayout>
  );
}
