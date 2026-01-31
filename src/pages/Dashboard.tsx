import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { TechnicianDashboard } from "@/components/dashboard/TechnicianDashboard";
import { CallStaffDashboard } from "@/components/dashboard/CallStaffDashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";

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
