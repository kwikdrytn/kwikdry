import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrainingVideo, useUpdateProgress } from "@/hooks/useTraining";
import { useToast } from "@/hooks/use-toast";
import type { YTPlayer, YTPlayerEvent } from "@/types/youtube.d";

interface VideoPlayerDialogProps {
  video: TrainingVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoPlayerDialog({ video, open, onOpenChange }: VideoPlayerDialogProps) {
  const { toast } = useToast();
  const updateProgress = useUpdateProgress();
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setPlayerReady(true);
      };
    } else {
      setPlayerReady(true);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Initialize player when dialog opens
  useEffect(() => {
    if (!open || !video || !playerReady || !containerRef.current || !window.YT) return;

    // Clear any existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    // Create player div
    const playerDiv = document.createElement("div");
    playerDiv.id = "youtube-player";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(playerDiv);

    // Initialize player
    playerRef.current = new window.YT.Player("youtube-player", {
      videoId: video.youtube_video_id,
      playerVars: {
        autoplay: 1,
        start: video.last_position_seconds || 0,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onStateChange: (event: YTPlayerEvent) => {
          if (window.YT && event.data === window.YT.PlayerState.ENDED) {
            handleVideoEnd();
          }
        },
      },
    });

    // Track progress every 5 seconds
    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0) {
          const progressPercent = Math.round((currentTime / duration) * 100);
          saveProgress(progressPercent, Math.floor(currentTime));
        }
      }
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [open, video, playerReady]);

  const saveProgress = (progressPercent: number, lastPosition: number) => {
    if (!video) return;

    updateProgress.mutate({
      videoId: video.id,
      progressPercent,
      lastPositionSeconds: lastPosition,
    });
  };

  const handleVideoEnd = () => {
    if (!video) return;

    updateProgress.mutate(
      {
        videoId: video.id,
        progressPercent: 100,
        lastPositionSeconds: video.duration_seconds || 0,
        isCompleted: true,
      },
      {
        onSuccess: () => {
          toast({
            title: "Video completed!",
            description: "Your progress has been saved.",
          });
        },
      }
    );
  };

  const handleClose = () => {
    // Save final progress before closing
    if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
      const currentTime = playerRef.current.getCurrentTime();
      const duration = playerRef.current.getDuration();
      if (duration > 0) {
        const progressPercent = Math.round((currentTime / duration) * 100);
        saveProgress(progressPercent, Math.floor(currentTime));
      }
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0">
        <DialogHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg line-clamp-1 pr-8">
            {video?.title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="aspect-video w-full bg-black" ref={containerRef}>
          {!playerReady && (
            <div className="w-full h-full flex items-center justify-center text-white">
              Loading player...
            </div>
          )}
        </div>

        {video?.description && (
          <div className="p-4 pt-2 text-sm text-muted-foreground">
            {video.description}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
