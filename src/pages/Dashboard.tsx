import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile } = useAuth();

  const firstName = profile?.first_name || "User";

  return (
    <DashboardLayout title="Dashboard" description="Welcome to your dashboard">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">
            Welcome, {firstName}! 👋
          </h2>
          <p className="max-w-md text-muted-foreground">
            Your dashboard is ready. Start by exploring the sidebar navigation to access different sections of the app.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
