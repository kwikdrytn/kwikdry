import { DashboardLayout } from "@/components/DashboardLayout";
import { JobMapView } from "@/components/job-map/JobMapView";

export default function JobMap() {
  return (
    <DashboardLayout 
      title="Job Map" 
      description="Geographic view of active jobs"
      fullHeight
    >
      <div className="h-[calc(100vh-4rem)]">
        <JobMapView />
      </div>
    </DashboardLayout>
  );
}
