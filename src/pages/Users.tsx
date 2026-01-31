import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users as UsersIcon } from "lucide-react";

export default function UsersPage() {
  return (
    <DashboardLayout title="Users" description="Manage team members and access">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>View and manage users in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[40vh] flex-col items-center justify-center text-center">
            <UsersIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">User management coming soon</p>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
