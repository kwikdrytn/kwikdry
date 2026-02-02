import { useState } from "react";
import { ChevronDown, Folder, BookOpen, Video, FileText, HelpCircle, Settings, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrainingVideo } from "@/hooks/useTraining";
import { TrainingVideoCard } from "./TrainingVideoCard";
import { cn } from "@/lib/utils";

interface TrainingCategorySectionProps {
  name: string;
  icon: string | null;
  videos: TrainingVideo[];
  completedCount: number;
  onPlayVideo: (video: TrainingVideo) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  book: BookOpen,
  video: Video,
  file: FileText,
  help: HelpCircle,
  settings: Settings,
  users: Users,
};

export function TrainingCategorySection({
  name,
  icon,
  videos,
  completedCount,
  onPlayVideo,
}: TrainingCategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const IconComponent = iconMap[icon || "folder"] || Folder;
  const allComplete = completedCount === videos.length && videos.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <IconComponent className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{name}</span>
          <span className={cn(
            "text-sm",
            allComplete ? "text-green-600" : "text-muted-foreground"
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
