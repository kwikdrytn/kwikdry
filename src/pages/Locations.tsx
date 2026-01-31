import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function LocationsPage() {
  return (
    <DashboardLayout title="Locations" description="Manage business locations">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Management
          </CardTitle>
          <CardDescription>View and manage locations in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[40vh] flex-col items-center justify-center text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Location management coming soon</p>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
