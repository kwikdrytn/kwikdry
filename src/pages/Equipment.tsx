import { useState } from "react";
import { Plus, LayoutGrid, Table as TableIcon, Wrench } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EquipmentFilters } from "@/components/equipment/EquipmentFilters";
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { EquipmentCards } from "@/components/equipment/EquipmentCards";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentDetailDialog } from "@/components/equipment/EquipmentDetailDialog";
import {
  useEquipmentList,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  Equipment,
  EquipmentFormData,
  EquipmentStatus,
} from "@/hooks/useEquipment";
import { useDebounce } from "@/hooks/useDebounce";

type ViewMode = "cards" | "table";

export default function EquipmentPage() {
  // View toggle
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  
  // Filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [assignedToFilter, setAssignedToFilter] = useState<string | null>(null);
  
  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  
  const debouncedSearch = useDebounce(search, 300);
  
  const { data: equipment = [], isLoading } = useEquipmentList({
    search: debouncedSearch || null,
    type: typeFilter,
    status: statusFilter,
    locationId: locationFilter,
    assignedTo: assignedToFilter === "unassigned" ? null : assignedToFilter,
  });

  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const handleView = (item: Equipment) => {
    setSelectedEquipment(item);
    setIsDetailOpen(true);
  };

  const handleEdit = (item: Equipment) => {
    setSelectedEquipment(item);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedEquipment(null);
    setIsFormOpen(true);
  };

  const handleSubmit = (data: EquipmentFormData) => {
    if (selectedEquipment) {
      updateEquipment.mutate(
        { id: selectedEquipment.id, data },
        { onSuccess: () => setIsFormOpen(false) }
      );
    } else {
      createEquipment.mutate(data, {
        onSuccess: () => setIsFormOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteEquipment.mutate(id, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  // Calculate stats
  const activeCount = equipment.filter(e => e.status === 'active').length;
  const maintenanceCount = equipment.filter(e => e.status === 'maintenance').length;
  const retiredCount = equipment.filter(e => e.status === 'retired').length;

  return (
    <DashboardLayout title="Equipment">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Equipment</CardDescription>
              <CardTitle className="text-3xl">{equipment.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Maintenance</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{maintenanceCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retired</CardDescription>
              <CardTitle className="text-3xl text-muted-foreground">{retiredCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Equipment
              </CardTitle>
              <CardDescription>
                Manage your equipment inventory, assignments, and maintenance schedules
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
              >
                <ToggleGroupItem value="cards" aria-label="Card view">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Equipment
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <EquipmentFilters
              search={search}
              type={typeFilter}
              status={statusFilter}
              locationId={locationFilter}
              assignedTo={assignedToFilter}
              onSearchChange={setSearch}
              onTypeChange={setTypeFilter}
              onStatusChange={setStatusFilter}
              onLocationChange={setLocationFilter}
              onAssignedToChange={setAssignedToFilter}
            />

            {viewMode === "table" ? (
              <EquipmentTable
                equipment={equipment}
                isLoading={isLoading}
                onView={handleView}
                onEdit={handleEdit}
              />
            ) : (
              <EquipmentCards
                equipment={equipment}
                isLoading={isLoading}
                onView={handleView}
                onEdit={handleEdit}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <EquipmentFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        equipment={selectedEquipment}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isLoading={createEquipment.isPending || updateEquipment.isPending}
        isDeleting={deleteEquipment.isPending}
      />

      <EquipmentDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        equipment={selectedEquipment}
      />
    </DashboardLayout>
  );
}
