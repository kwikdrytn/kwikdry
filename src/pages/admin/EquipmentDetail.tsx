import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays, isPast } from "date-fns";
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Wrench, 
  MapPin, 
  User, 
  Calendar, 
  DollarSign,
  Shield,
  Plus,
  ImagePlus,
  Save,
  X
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquipmentStatusBadge, MaintenanceBadge } from "@/components/equipment/EquipmentStatusBadge";
import { MaintenanceTypeBadge } from "@/components/equipment/MaintenanceTypeBadge";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { ReassignEquipmentDialog } from "@/components/equipment/ReassignEquipmentDialog";
import { MaintenanceFormDialog } from "@/components/equipment/MaintenanceFormDialog";
import { EquipmentPhotoGallery } from "@/components/equipment/EquipmentPhotoGallery";
import {
  useEquipmentItem,
  useUpdateEquipment,
  useDeleteEquipment,
  useEquipmentMaintenance,
  useEquipmentMaintenanceCost,
  EquipmentFormData,
} from "@/hooks/useEquipment";

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Extractor',
  wand: 'Wand',
  hose: 'Hose',
  vehicle: 'Vehicle',
  other: 'Other',
};

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");

  const { data: equipment, isLoading } = useEquipmentItem(id);
  const { data: maintenanceRecords = [] } = useEquipmentMaintenance(id);
  const { data: totalMaintenanceCost = 0 } = useEquipmentMaintenanceCost(id);
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const handleBack = () => {
    navigate("/equipment");
  };

  const handleEdit = (data: EquipmentFormData) => {
    if (!equipment) return;
    updateEquipment.mutate(
      { id: equipment.id, data },
      { onSuccess: () => setIsEditOpen(false) }
    );
  };

  const handleDelete = () => {
    if (!equipment) return;
    deleteEquipment.mutate(equipment.id, {
      onSuccess: () => navigate("/equipment"),
    });
  };

  const handleSaveNotes = () => {
    if (!equipment) return;
    updateEquipment.mutate(
      { id: equipment.id, data: { notes: editedNotes } },
      { 
        onSuccess: () => {
          setIsEditingNotes(false);
        }
      }
    );
  };

  const startEditingNotes = () => {
    setEditedNotes(equipment?.notes || "");
    setIsEditingNotes(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Equipment">
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!equipment) {
    return (
      <DashboardLayout title="Equipment">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Equipment not found</p>
          <Button variant="link" onClick={handleBack}>
            Back to Equipment List
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const assignedName = equipment.assigned_first_name || equipment.assigned_last_name
    ? `${equipment.assigned_first_name || ''} ${equipment.assigned_last_name || ''}`.trim()
    : null;

  // Calculate warranty status
  const warrantyExpiry = equipment.warranty_expiry ? parseISO(equipment.warranty_expiry) : null;
  const warrantyExpired = warrantyExpiry ? isPast(warrantyExpiry) : false;
  const daysUntilWarrantyExpiry = warrantyExpiry ? differenceInDays(warrantyExpiry, new Date()) : null;

  // Get upcoming maintenance
  const upcomingMaintenance = maintenanceRecords.find(m => m.next_due && !isPast(parseISO(m.next_due)));

  return (
    <DashboardLayout title="Equipment">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{equipment.name}</h1>
                <Badge variant="outline">{TYPE_LABELS[equipment.type] || equipment.type}</Badge>
                <EquipmentStatusBadge status={equipment.status} />
              </div>
              {equipment.serial_number && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  S/N: {equipment.serial_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Serial Number
              </CardDescription>
              <CardTitle className="text-lg font-mono">
                {equipment.serial_number || "—"}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                Model / Manufacturer
              </CardDescription>
              <CardTitle className="text-lg">
                {equipment.model || equipment.manufacturer ? (
                  <>
                    {equipment.model || "—"}
                    {equipment.manufacturer && (
                      <span className="text-sm font-normal text-muted-foreground block">
                        by {equipment.manufacturer}
                      </span>
                    )}
                  </>
                ) : "—"}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Purchase Date / Price
              </CardDescription>
              <CardTitle className="text-lg">
                {equipment.purchase_date ? (
                  format(parseISO(equipment.purchase_date), "MMM d, yyyy")
                ) : "—"}
                {equipment.purchase_price && (
                  <span className="text-sm font-normal text-muted-foreground block">
                    ${equipment.purchase_price.toLocaleString()}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Warranty Status
              </CardDescription>
              <CardTitle className="text-lg">
                {warrantyExpiry ? (
                  <div className="flex items-center gap-2">
                    {warrantyExpired ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <span>Valid until {format(warrantyExpiry, "MMM d, yyyy")}</span>
                    )}
                    {!warrantyExpired && daysUntilWarrantyExpiry !== null && daysUntilWarrantyExpiry <= 30 && (
                      <Badge variant="secondary" className="text-xs">
                        {daysUntilWarrantyExpiry} days left
                      </Badge>
                    )}
                  </div>
                ) : (
                  "—"
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Assignment Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Assignment</CardTitle>
              <CardDescription>Current location and technician assignment</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setIsReassignOpen(true)}>
              Reassign
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{equipment.location_name || "No location assigned"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{assignedName || "Unassigned"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Maintenance</CardTitle>
              <CardDescription>Track maintenance history and schedule</CardDescription>
            </div>
            <Button onClick={() => setIsMaintenanceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Maintenance Record
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upcoming Maintenance */}
            {upcomingMaintenance && upcomingMaintenance.next_due && (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Upcoming Maintenance
                    </CardDescription>
                    <MaintenanceBadge nextDue={upcomingMaintenance.next_due} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{upcomingMaintenance.type.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {format(parseISO(upcomingMaintenance.next_due), "MMMM d, yyyy")}
                      </p>
                    </div>
                    <p className="text-2xl font-bold">
                      {differenceInDays(parseISO(upcomingMaintenance.next_due), new Date())}
                      <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Maintenance History */}
            {maintenanceRecords.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceRecords.map((record: any) => (
                        <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            {format(parseISO(record.performed_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <MaintenanceTypeBadge type={record.type} />
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.description}
                          </TableCell>
                          <TableCell>
                            {record.profiles?.first_name && record.profiles?.last_name
                              ? `${record.profiles.first_name} ${record.profiles.last_name}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {record.cost ? `$${Number(record.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Total Maintenance Cost */}
                <div className="flex justify-end">
                  <div className="bg-muted/50 rounded-lg px-4 py-2 text-right">
                    <p className="text-sm text-muted-foreground">Total Maintenance Cost</p>
                    <p className="text-xl font-bold font-mono">
                      ${totalMaintenanceCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No maintenance records yet. Add your first maintenance record above.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Photos</CardTitle>
              <CardDescription>Equipment photos and documentation</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <EquipmentPhotoGallery equipmentId={equipment.id} />
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Notes</CardTitle>
              <CardDescription>Additional notes and comments</CardDescription>
            </div>
            {!isEditingNotes && (
              <Button variant="outline" size="sm" onClick={startEditingNotes}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Enter notes about this equipment..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateEquipment.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingNotes(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {equipment.notes || <span className="text-muted-foreground italic">No notes added</span>}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <EquipmentFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        equipment={equipment}
        onSubmit={handleEdit}
        isLoading={updateEquipment.isPending}
      />

      <ReassignEquipmentDialog
        open={isReassignOpen}
        onOpenChange={setIsReassignOpen}
        equipment={equipment}
      />

      <MaintenanceFormDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        equipmentId={equipment.id}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{equipment.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
