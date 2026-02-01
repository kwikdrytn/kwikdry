import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users as UsersIcon } from "lucide-react";
import { UserTable } from "@/components/users/UserTable";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { DeactivateUserDialog } from "@/components/users/DeactivateUserDialog";
import { UserFilters } from "@/components/users/UserFilters";
import { RolesManagement } from "@/components/users/RolesManagement";
import { 
  useUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeactivateUser,
  UserProfile,
  UserFormData 
} from "@/hooks/useUsers";

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState("users");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const { data: users = [], isLoading } = useUsers({
    locationId: locationFilter,
    role: roleFilter,
  });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeactivateUser = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeactivateOpen(true);
  };

  const handleFormSubmit = (data: UserFormData) => {
    if (selectedUser) {
      updateUser.mutate(
        { id: selectedUser.id, data },
        { onSuccess: () => setIsFormOpen(false) }
      );
    } else {
      createUser.mutate(data, { onSuccess: () => setIsFormOpen(false) });
    }
  };

  const handleDeactivateConfirm = () => {
    if (selectedUser) {
      deactivateUser.mutate(selectedUser.id, {
        onSuccess: () => {
          setIsDeactivateOpen(false);
          setSelectedUser(null);
        },
      });
    }
  };

  return (
    <DashboardLayout title="User Management">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Users
                  </CardTitle>
                  <CardDescription>
                    {users.length} user{users.length !== 1 ? 's' : ''} in your organization
                  </CardDescription>
                </div>
                <Button onClick={handleAddUser} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <UserFilters
                  locationId={locationFilter}
                  role={roleFilter}
                  onLocationChange={setLocationFilter}
                  onRoleChange={setRoleFilter}
                />
                
                <UserTable
                  users={users}
                  isLoading={isLoading}
                  onEdit={handleEditUser}
                  onDeactivate={handleDeactivateUser}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <RolesManagement />
          </TabsContent>
        </Tabs>
      </div>

      <UserFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        user={selectedUser}
        onSubmit={handleFormSubmit}
        isLoading={createUser.isPending || updateUser.isPending}
      />

      <DeactivateUserDialog
        open={isDeactivateOpen}
        onOpenChange={setIsDeactivateOpen}
        user={selectedUser}
        onConfirm={handleDeactivateConfirm}
        isLoading={deactivateUser.isPending}
      />
    </DashboardLayout>
  );
}
