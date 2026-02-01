import { DashboardLayout } from "@/components/DashboardLayout";
import { Package } from "lucide-react";

export default function Inventory() {
  return (
    <DashboardLayout title="Inventory">
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Package className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Inventory Management</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Track and manage your inventory items, stock levels, and supplies.
        </p>
      </div>
    </DashboardLayout>
  );
}
