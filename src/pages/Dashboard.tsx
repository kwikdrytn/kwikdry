import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { TechnicianDashboard } from "@/components/dashboard/TechnicianDashboard";
import { CallStaffDashboard } from "@/components/dashboard/CallStaffDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

function AdminDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.first_name || "User";
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Admin Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Locations</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jobs Today</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Calls Today</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground max-w-md">
              Use the sidebar navigation to access user management, inventory, equipment, and other admin functions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();

  const renderDashboard = () => {
    switch (profile?.role) {
      case 'technician':
        return <TechnicianDashboard />;
      case 'call_staff':
        return <CallStaffDashboard />;
      case 'admin':
      default:
        return <AdminDashboard />;
    }
  };

  const getDescription = () => {
    switch (profile?.role) {
      case 'technician':
        return "Your daily tasks and assignments";
      case 'call_staff':
        return "Call handling and bookings overview";
      default:
        return "Organization overview";
    }
  };

  return (
    <DashboardLayout title="Dashboard" description={getDescription()}>
      {renderDashboard()}
    </DashboardLayout>
  );
}
