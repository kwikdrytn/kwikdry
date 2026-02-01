import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Upload, Pencil, X, CheckSquare } from "lucide-react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { InventoryFormDialog } from "@/components/inventory/InventoryFormDialog";
import { CsvImportDialog } from "@/components/inventory/CsvImportDialog";
import { BulkEditDialog, BulkEditUpdates } from "@/components/inventory/BulkEditDialog";
import { 
  useInventoryItems, 
  useCreateInventoryItem,
  useBulkCreateInventoryItems,
  useBulkUpdateInventoryItems,
  InventoryItemFormData,
  BulkImportItem,
} from "@/hooks/useInventory";
import { useDebounce } from "@/hooks/useDebounce";

export default function InventoryManagement() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const debouncedSearch = useDebounce(search, 300);

  const { data: items = [], isLoading } = useInventoryItems({
    category: categoryFilter,
    search: debouncedSearch || null,
  });

  const createItem = useCreateInventoryItem();
  const bulkCreateItems = useBulkCreateInventoryItems();
  const bulkUpdateItems = useBulkUpdateInventoryItems();

  const handleCreateItem = (data: InventoryItemFormData) => {
    createItem.mutate(data, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  const handleImportItems = (items: BulkImportItem[], locationId: string | null) => {
    const itemsWithLocation = items.map(item => ({
      ...item,
      location_id: locationId || undefined,
    }));
    bulkCreateItems.mutate(itemsWithLocation, {
      onSuccess: () => setIsImportOpen(false),
    });
  };

  const handleBulkEdit = (updates: BulkEditUpdates) => {
    if (selectedIds.size === 0) return;
    
    bulkUpdateItems.mutate(
      { ids: Array.from(selectedIds), updates },
      {
        onSuccess: () => {
          setIsBulkEditOpen(false);
          setSelectedIds(new Set());
          setSelectionMode(false);
        },
      }
    );
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
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

        {/* Bulk Actions Bar */}
        {selectionMode && (
          <Card className="border-primary">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set(items.map(i => i.id)))}
                >
                  Select All ({items.length})
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsBulkEditOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSelection}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Items
              </CardTitle>
              <CardDescription>
                {selectionMode 
                  ? "Click items to select them for bulk editing" 
                  : "Click an item to view details and manage stock"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!selectionMode && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectionMode(true)} 
                    className="gap-2"
                    disabled={items.length === 0}
                  >
                    <CheckSquare className="h-4 w-4" />
                    Bulk Edit
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </>
              )}
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
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
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

      <BulkEditDialog
        open={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        selectedCount={selectedIds.size}
        onSave={handleBulkEdit}
        isLoading={bulkUpdateItems.isPending}
      />
    </DashboardLayout>
  );
}
