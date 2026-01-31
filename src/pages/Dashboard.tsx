import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Dashboard" description="Welcome to your dashboard">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">
            Welcome, {user?.full_name?.split(" ")[0] || "User"}! 👋
          </h2>
          <p className="max-w-md text-muted-foreground">
            Your dashboard is ready. Start by exploring the sidebar navigation to access different sections of the app.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
