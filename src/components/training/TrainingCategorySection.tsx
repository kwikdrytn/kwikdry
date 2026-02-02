import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrainingVideo } from "@/hooks/useTraining";
import { TrainingVideoCard } from "./TrainingVideoCard";
import { cn } from "@/lib/utils";

interface TrainingCategorySectionProps {
  name: string;
  videos: TrainingVideo[];
  completedCount: number;
  onPlayVideo: (video: TrainingVideo) => void;
}

export function TrainingCategorySection({
  name,
  videos,
  completedCount,
  onPlayVideo,
}: TrainingCategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const allComplete = completedCount === videos.length && videos.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-medium">{name}</span>
          <span className={cn(
            "text-sm",
            allComplete ? "text-success" : "text-muted-foreground"
          )}>
            {completedCount} of {videos.length} complete
          </span>
        </div>
        <ChevronDown className={cn(
          "h-5 w-5 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
          {videos.map((video) => (
            <TrainingVideoCard
              key={video.id}
              video={video}
              onPlay={onPlayVideo}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
