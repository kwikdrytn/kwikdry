import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  RoleWithPermissions,
  PermissionKey,
  PERMISSION_GROUPS,
  useCreateRole,
  useUpdateRole,
} from "@/hooks/useRoles";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleWithPermissions | null;
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const isEditing = !!role;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [selectedPermissions, setSelectedPermissions] = useState<Set<PermissionKey>>(new Set());

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || "",
      });
      setSelectedPermissions(new Set(role.permissions));
    } else {
      form.reset({
        name: "",
        description: "",
      });
      setSelectedPermissions(new Set());
    }
  }, [role, form]);

  const togglePermission = (permission: PermissionKey) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permission)) {
      newSet.delete(permission);
    } else {
      newSet.add(permission);
    }
    setSelectedPermissions(newSet);
  };

  const toggleGroup = (groupKey: string) => {
    const group = PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS];
    const groupPermissions = group.permissions.map(p => p.key as PermissionKey);
    const allSelected = groupPermissions.every(p => selectedPermissions.has(p));

    const newSet = new Set(selectedPermissions);
    if (allSelected) {
      groupPermissions.forEach(p => newSet.delete(p));
    } else {
      groupPermissions.forEach(p => newSet.add(p));
    }
    setSelectedPermissions(newSet);
  };

  const selectAll = () => {
    const allPermissions = Object.values(PERMISSION_GROUPS).flatMap(g =>
      g.permissions.map(p => p.key as PermissionKey)
    );
    setSelectedPermissions(new Set(allPermissions));
  };

  const selectNone = () => {
    setSelectedPermissions(new Set());
  };

  const onSubmit = async (values: FormValues) => {
    const data = {
      name: values.name,
      description: values.description,
      permissions: Array.from(selectedPermissions),
    };

    if (isEditing && role) {
      await updateRole.mutateAsync({ id: role.id, data });
    } else {
      await createRole.mutateAsync(data);
    }

    onOpenChange(false);
  };

  const isPending = createRole.isPending || updateRole.isPending;
  const isSystemRole = role?.is_system;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle>{isEditing ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the role details and permissions."
              : "Create a new role with custom permissions."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form id="role-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Senior Technician" 
                          {...field} 
                          disabled={isSystemRole}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this role..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Permissions</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which permissions this role should have.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={selectNone}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
                    const groupPermissions = group.permissions.map(p => p.key as PermissionKey);
                    const selectedCount = groupPermissions.filter(p => 
                      selectedPermissions.has(p)
                    ).length;
                    const allSelected = selectedCount === groupPermissions.length;

                    return (
                      <div key={groupKey} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleGroup(groupKey)}
                            />
                            <span className="font-medium">{group.label}</span>
                            <Badge variant="secondary" className="text-xs">
                              {selectedCount}/{groupPermissions.length}
                            </Badge>
                          </div>
                        </div>
                        <div className="ml-6 grid gap-2">
                          {group.permissions.map((permission) => (
                            <div key={permission.key} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedPermissions.has(permission.key as PermissionKey)}
                                onCheckedChange={() => togglePermission(permission.key as PermissionKey)}
                              />
                              <span className="text-sm">{permission.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="role-form" disabled={isPending}>
            {isPending ? "Saving..." : isEditing ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
