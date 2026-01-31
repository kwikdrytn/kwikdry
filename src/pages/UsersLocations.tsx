import { DashboardLayout } from "@/components/DashboardLayout";
import { MapPin } from "lucide-react";

export default function UsersLocations() {
  return (
    <DashboardLayout title="Users Locations" description="Track team member positions">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <MapPin className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Team Locations</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Real-time tracking of team members' locations for efficient dispatch and coordination.
        </p>
      </div>
    </DashboardLayout>
  );
}
