import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Inbox } from "lucide-react";
import { useUnscheduledJobs } from "@/hooks/useSchedule";
import { JobBlock } from "./JobBlock";
import type { HCPJob } from "@/hooks/useJobMap";

interface Props {
  onJobClick: (job: HCPJob) => void;
}

export function UnscheduledQueue({ onJobClick }: Props) {
  const { data: jobs = [], isLoading } = useUnscheduledJobs();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;
  if (jobs.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b bg-muted/30 px-4 py-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <Inbox className="h-4 w-4" />
            <span className="font-medium">Unscheduled jobs</span>
            <Badge variant="secondary">{jobs.length}</Badge>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {jobs.map((j) => (
              <JobBlock key={j.id} job={j} onClick={onJobClick} draggable={false} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
