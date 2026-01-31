import { DashboardLayout } from "@/components/DashboardLayout";
import { ClipboardCheck } from "lucide-react";

export default function Checklists() {
  return (
    <DashboardLayout title="Checklists" description="Manage tasks and inspections">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <ClipboardCheck className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Checklists</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Create and manage inspection checklists, task lists, and quality assurance procedures.
        </p>
      </div>
    </DashboardLayout>
  );
}
