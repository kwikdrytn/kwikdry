import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Check, AlertTriangle, ChevronRight, Award } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useTrainingVideo,
  useNextVideo,
  useUpdateProgress,
  useMarkComplete,
  formatDuration,
} from "@/hooks/useTraining";
import type { YTPlayer, YTPlayerEvent } from "@/types/youtube.d";

export default function TrainingVideo() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const { data: video, isLoading, error } = useTrainingVideo(id);
  const { data: nextVideo } = useNextVideo(id, video?.category_id || null);
  const updateProgress = useUpdateProgress();
  const markComplete = useMarkComplete();

  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [localCompleted, setLocalCompleted] = useState(false);
  
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const isCompleted = video?.is_completed || localCompleted;

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) {
      setPlayerReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true);
    };
  }, []);

  const saveProgress = useCallback(
    (progressPercent: number, lastPosition: number, watchTimeIncrement: number = 0) => {
      if (!video) return;

      updateProgress.mutate(
        {
          videoId: video.id,
          progressPercent,
          lastPositionSeconds: lastPosition,
          watchTimeIncrement,
        },
        {
          onSuccess: (result) => {
            if (result?.isCompleted && !isCompleted) {
              setLocalCompleted(true);
              setShowConfetti(true);
              toast({
                title: "🎉 Training video completed!",
                description: "Great job! Your progress has been saved.",
              });
              setTimeout(() => setShowConfetti(false), 3000);
            }
          },
        }
      );
    },
    [video, updateProgress, isCompleted, toast]
  );

  const handleStateChange = useCallback(
    (event: YTPlayerEvent) => {
      if (!window.YT) return;

      const state = event.data;
      const player = event.target;

      // When playing, start tracking
      if (state === window.YT.PlayerState.PLAYING) {
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Track every 30 seconds
        intervalRef.current = setInterval(() => {
          if (player?.getCurrentTime && player?.getDuration) {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            if (duration > 0) {
              const progressPercent = Math.round((currentTime / duration) * 100);
              const now = Date.now();
              const timeSinceLastSave = (now - lastSaveTimeRef.current) / 1000;
              lastSaveTimeRef.current = now;
              
              saveProgress(progressPercent, Math.floor(currentTime), Math.floor(timeSinceLastSave));
            }
          }
        }, 30000);
      }

      // When paused or ended, clear interval and save
      if (
        state === window.YT.PlayerState.PAUSED ||
        state === window.YT.PlayerState.ENDED
      ) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        if (player?.getCurrentTime && player?.getDuration) {
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          if (duration > 0) {
            const progressPercent = Math.round((currentTime / duration) * 100);
            const now = Date.now();
            const timeSinceLastSave = (now - lastSaveTimeRef.current) / 1000;
            lastSaveTimeRef.current = now;
            
            saveProgress(progressPercent, Math.floor(currentTime), Math.floor(timeSinceLastSave));
          }
        }
      }
    },
    [saveProgress]
  );

  // Initialize player when ready
  useEffect(() => {
    if (!playerReady || !video || !containerRef.current || !window.YT) return;

    // Cleanup previous player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // Ignore destroy errors
      }
      playerRef.current = null;
    }

    // Create player div
    const playerDiv = document.createElement("div");
    playerDiv.id = "youtube-player";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(playerDiv);

    try {
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId: video.youtube_video_id,
        playerVars: {
          autoplay: 0,
          start: video.last_position_seconds || 0,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onStateChange: handleStateChange,
          onReady: () => {
            lastSaveTimeRef.current = Date.now();
          },
          onError: () => {
            setPlayerError(true);
          },
        },
      });
    } catch {
      setPlayerError(true);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
      }
    };
  }, [playerReady, video?.id, video?.youtube_video_id, video?.last_position_seconds, handleStateChange]);

  const handleMarkComplete = () => {
    if (!video) return;
    
    markComplete.mutate(video.id, {
      onSuccess: () => {
        setLocalCompleted(true);
        setShowConfetti(true);
        toast({
          title: "🎉 Video marked as complete!",
          description: "Great job finishing this training!",
        });
        setTimeout(() => setShowConfetti(false), 3000);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to mark video as complete. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Training Video">
        <div className="space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !video) {
    return (
      <DashboardLayout title="Video Not Found">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Video Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The training video you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link to="/training">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Training
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const progressPercent = video.progress_percent || 0;
  const canMarkComplete = progressPercent >= 80 && !isCompleted;

  return (
    <DashboardLayout title={video.title}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Confetti overlay */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="text-6xl animate-bounce">🎉</div>
          </div>
        )}

        {/* Back button */}
        <Button variant="ghost" asChild className="pl-0">
          <Link to="/training">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Training
          </Link>
        </Button>

        {/* Video player */}
        <div className="relative">
          {playerError ? (
            <Card className="aspect-video flex items-center justify-center bg-muted">
              <CardContent className="text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Failed to load video</h3>
                <p className="text-sm text-muted-foreground">
                  Please check your internet connection and try again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              ref={containerRef}
              className="aspect-video w-full bg-black rounded-lg overflow-hidden"
            >
              {!playerReady && (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video info */}
        <div className="space-y-4">
          {/* Title and badges */}
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-bold flex-1">{video.title}</h1>
            <div className="flex flex-wrap gap-2">
              {video.category_name && (
                <Badge variant="secondary">{video.category_name}</Badge>
              )}
              {video.is_required && (
                <Badge variant="destructive">Required</Badge>
              )}
            </div>
          </div>

          {/* Duration and completion status */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {video.duration_seconds && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(video.duration_seconds)}</span>
              </div>
            )}
            
            {isCompleted ? (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="font-medium">Completed</span>
              </div>
            ) : progressPercent > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{progressPercent}% complete</span>
                <Progress value={progressPercent} className="w-24 h-2" />
              </div>
            ) : null}
          </div>

          {/* Description */}
          {video.description && (
            <p className="text-muted-foreground">{video.description}</p>
          )}

          {/* Mark as complete button */}
          {canMarkComplete && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    Ready to mark this video as complete?
                  </span>
                </div>
                <Button onClick={handleMarkComplete} disabled={markComplete.isPending}>
                  <Check className="mr-2 h-4 w-4" />
                  Mark as Complete
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
          <Button variant="outline" asChild className="flex-1 sm:flex-none">
            <Link to="/training">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Training
            </Link>
          </Button>

          {nextVideo && (
            <Button asChild className="flex-1 sm:flex-none sm:ml-auto">
              <Link to={`/training/video/${nextVideo.id}`}>
                Next: {nextVideo.title}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
