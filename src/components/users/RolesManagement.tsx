import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useCustomRoles, 
  useDeleteRole, 
  RoleWithPermissions,
  PERMISSION_GROUPS 
} from "@/hooks/useRoles";
import { RoleFormDialog } from "./RoleFormDialog";
import { Plus, Pencil, Trash2, Shield, Users } from "lucide-react";
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

export function RolesManagement() {
  const { data: roles, isLoading } = useCustomRoles();
  const deleteRole = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithPermissions | null>(null);

  const handleEdit = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = (role: RoleWithPermissions) => {
    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (roleToDelete) {
      await deleteRole.mutateAsync(roleToDelete.id);
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
    }
  };

  const getPermissionCount = (role: RoleWithPermissions) => {
    const total = Object.values(PERMISSION_GROUPS).reduce(
      (acc, group) => acc + group.permissions.length, 
      0
    );
    return `${role.permissions.length}/${total}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Create custom roles with specific permissions for your team.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {roles?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No custom roles yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first custom role to assign granular permissions.
            </p>
            <Button className="mt-4" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {role.name}
                      {role.is_system && (
                        <Badge variant="secondary" className="text-xs">System</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {role.description || "No description"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    {getPermissionCount(role)} permissions
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(role)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {!role.is_system && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteConfirm(role)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roleToDelete?.name}"? 
              Users with this role will need to be reassigned.
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
    </div>
  );
}
