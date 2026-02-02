import { Link } from "react-router-dom";
import { Play, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TrainingVideo, formatDuration, getYouTubeThumbnail } from "@/hooks/useTraining";

interface ContinueWatchingCardProps {
  video: TrainingVideo;
  onContinue: (video: TrainingVideo) => void;
}

export function ContinueWatchingCard({ video, onContinue }: ContinueWatchingCardProps) {
  const thumbnail = video.thumbnail_url || getYouTubeThumbnail(video.youtube_video_id);
  const remainingSeconds = video.duration_seconds 
    ? video.duration_seconds - (video.last_position_seconds || 0)
    : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <Link 
            to={`/training/video/${video.id}`}
            className="relative sm:w-64 shrink-0 group"
          >
            <div className="aspect-video sm:aspect-auto sm:h-full">
              <img
                src={thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
              </div>
            </div>
            {video.duration_seconds && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {formatDuration(video.duration_seconds)}
              </div>
            )}
          </Link>

          {/* Content */}
          <div className="flex-1 p-4 flex flex-col justify-between gap-4">
            <div>
              <Link to={`/training/video/${video.id}`}>
                <h3 className="font-semibold text-lg line-clamp-2 hover:text-primary transition-colors">
                  {video.title}
                </h3>
              </Link>
              {video.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {video.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{video.progress_percent}% complete</span>
                </div>
                {remainingSeconds && remainingSeconds > 0 && (
                  <span>• {formatDuration(remainingSeconds)} remaining</span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <Progress value={video.progress_percent} className="h-2 flex-1" />
                <Button onClick={() => onContinue(video)} className="shrink-0">
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
