import { DashboardLayout } from "@/components/DashboardLayout";
import { Phone } from "lucide-react";

export default function Calls() {
  return (
    <DashboardLayout title="Calls">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Phone className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Call Management</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          View and manage incoming job calls, service requests, and customer communications.
        </p>
      </div>
    </DashboardLayout>
  );
}
