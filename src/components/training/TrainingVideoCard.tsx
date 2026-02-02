import { Link } from "react-router-dom";
import { Check, Play, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrainingVideo, formatDuration, getYouTubeThumbnail } from "@/hooks/useTraining";
import { cn } from "@/lib/utils";

interface TrainingVideoCardProps {
  video: TrainingVideo;
  onPlay: (video: TrainingVideo) => void;
}

export function TrainingVideoCard({ video, onPlay }: TrainingVideoCardProps) {
  const thumbnail = video.thumbnail_url || getYouTubeThumbnail(video.youtube_video_id);
  const isInProgress = video.progress_percent > 0 && !video.is_completed;

  return (
    <Link to={`/training/video/${video.id}`}>
      <Card 
        className={cn(
          "overflow-hidden transition-all hover:shadow-md cursor-pointer group h-full",
          video.is_completed && "ring-2 ring-green-500/20"
        )}
      >
        <div className="relative aspect-video">
          <img
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-6 w-6 text-primary fill-primary ml-1" />
            </div>
          </div>

          {/* Duration badge */}
          {video.duration_seconds && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration_seconds)}
            </div>
          )}

          {/* Completed checkmark */}
          {video.is_completed && (
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="h-5 w-5 text-white" />
            </div>
          )}

          {/* Required badge */}
          {video.is_required && !video.is_completed && (
            <Badge 
              variant="destructive" 
              className="absolute top-2 left-2 text-xs"
            >
              Required
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
            {video.title}
          </h3>

          {isInProgress ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{video.progress_percent}% complete</span>
              </div>
              <Progress value={video.progress_percent} className="h-1" />
            </div>
          ) : video.is_completed ? (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Not started
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
