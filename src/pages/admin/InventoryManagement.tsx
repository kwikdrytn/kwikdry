import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Upload, Pencil, X, CheckSquare, Trash2 } from "lucide-react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { InventoryFormDialog } from "@/components/inventory/InventoryFormDialog";
import { CsvImportDialog } from "@/components/inventory/CsvImportDialog";
import { BulkEditDialog, BulkEditUpdates } from "@/components/inventory/BulkEditDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  useInventoryItems, 
  useCreateInventoryItem,
  useBulkCreateInventoryItems,
  useBulkUpdateInventoryItems,
  useBulkDeleteInventoryItems,
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
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
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
  const bulkDeleteItems = useBulkDeleteInventoryItems();

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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    
    bulkDeleteItems.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        setSelectedIds(new Set());
        setSelectionMode(false);
      },
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
        <div className="grid gap-4 grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs sm:text-sm">Total Items</CardDescription>
              <CardTitle className="text-xl sm:text-3xl">{items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs sm:text-sm">Low Stock</CardDescription>
              <CardTitle className="text-xl sm:text-3xl text-destructive">{lowStockCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs sm:text-sm">In Stock</CardDescription>
              <CardTitle className="text-xl sm:text-3xl text-primary">{items.length - lowStockCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        {selectionMode && (
          <Card className="border-primary">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set(items.map(i => i.id)))}
                >
                  Select All
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsBulkEditOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
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
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory Items
              </CardTitle>
              <CardDescription className="hidden sm:block">
                {selectionMode 
                  ? "Click items to select them for bulk editing" 
                  : "Click an item to view details and manage stock"}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!selectionMode && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectionMode(true)} 
                    className="gap-2"
                    disabled={items.length === 0}
                    size="sm"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Bulk Edit</span>
                    <span className="sm:hidden">Bulk</span>
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2" size="sm">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Import CSV</span>
                    <span className="sm:hidden">Import</span>
                  </Button>
                  <Button onClick={() => setIsFormOpen(true)} className="gap-2" size="sm">
                    <Plus className="h-4 w-4" />
                    Add
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

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected inventory items. This action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteItems.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
