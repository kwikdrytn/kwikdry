import { DashboardLayout } from "@/components/DashboardLayout";
import { Map } from "lucide-react";

export default function JobMap() {
  return (
    <DashboardLayout title="Job Map" description="Geographic view of active jobs">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Map className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Job Map</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          View all active jobs on an interactive map with route optimization and location details.
        </p>
      </div>
    </DashboardLayout>
  );
}
