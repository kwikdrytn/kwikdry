import { DashboardLayout } from "@/components/DashboardLayout";
import { Wrench } from "lucide-react";

export default function Equipment() {
  return (
    <DashboardLayout title="Equipment">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Wrench className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Equipment Tracking</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Monitor equipment status, maintenance schedules, and asset locations.
        </p>
      </div>
    </DashboardLayout>
  );
}
