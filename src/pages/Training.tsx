import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Video, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TrainingProgressSummary } from "@/components/training/TrainingProgressSummary";
import { ContinueWatchingCard } from "@/components/training/ContinueWatchingCard";
import { TrainingVideoCard } from "@/components/training/TrainingVideoCard";
import { TrainingCategorySection } from "@/components/training/TrainingCategorySection";
import { useTrainingVideos, TrainingVideo, TrainingCategory } from "@/hooks/useTraining";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function Training() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: videos, isLoading } = useTrainingVideos();

  // Get required videos for user's role
  const requiredVideos = useMemo(() => {
    if (!videos || !profile?.role) return [];
    
    return videos
      .filter((v) => v.is_required && v.required_for_roles.includes(profile.role))
      .sort((a, b) => {
        // Incomplete first, then by sort_order
        if (a.is_completed !== b.is_completed) {
          return a.is_completed ? 1 : -1;
        }
        return a.sort_order - b.sort_order;
      });
  }, [videos, profile?.role]);

  // Get continue watching video (most recently watched incomplete)
  const continueWatching = useMemo(() => {
    if (!videos) return null;
    
    const inProgress = videos
      .filter((v) => v.progress_percent > 0 && !v.is_completed && v.last_watched_at)
      .sort((a, b) => {
        const dateA = new Date(a.last_watched_at || 0).getTime();
        const dateB = new Date(b.last_watched_at || 0).getTime();
        return dateB - dateA;
      });
    
    return inProgress[0] || null;
  }, [videos]);

  // Group videos by category
  const categories = useMemo((): TrainingCategory[] => {
    if (!videos) return [];

    const categoryMap = new Map<string, TrainingCategory>();
    const uncategorized: TrainingVideo[] = [];

    videos.forEach((video) => {
      if (video.category_id && video.category_name) {
        const existing = categoryMap.get(video.category_id);
        if (existing) {
          existing.videos.push(video);
          if (video.is_completed) existing.completedCount++;
        } else {
          categoryMap.set(video.category_id, {
            id: video.category_id,
            name: video.category_name,
            icon: video.category_icon || "folder",
            sort_order: video.category_sort_order || 0,
            videos: [video],
            completedCount: video.is_completed ? 1 : 0,
            totalCount: 0,
          });
        }
      } else {
        uncategorized.push(video);
      }
    });

    // Update total counts and sort videos
    categoryMap.forEach((cat) => {
      cat.totalCount = cat.videos.length;
      cat.videos.sort((a, b) => a.sort_order - b.sort_order);
    });

    const result = Array.from(categoryMap.values()).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    // Add uncategorized if any
    if (uncategorized.length > 0) {
      result.push({
        id: "uncategorized",
        name: "Other Videos",
        icon: "folder",
        sort_order: 999,
        videos: uncategorized.sort((a, b) => a.sort_order - b.sort_order),
        completedCount: uncategorized.filter((v) => v.is_completed).length,
        totalCount: uncategorized.length,
      });
    }

    return result;
  }, [videos]);

  // Calculate required completion stats
  const requiredCompleted = requiredVideos.filter((v) => v.is_completed).length;
  const allRequiredComplete = requiredCompleted === requiredVideos.length && requiredVideos.length > 0;

  const handlePlayVideo = (video: TrainingVideo) => {
    navigate(`/training/video/${video.id}`);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Training Videos">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Training Videos">
      <div className="space-y-8">
        {/* Progress Summary */}
        {requiredVideos.length > 0 && (
          <TrainingProgressSummary
            completedCount={requiredCompleted}
            totalCount={requiredVideos.length}
          />
        )}

        {/* Continue Watching */}
        {continueWatching && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Video className="h-5 w-5" />
              Continue Watching
            </h2>
            <ContinueWatchingCard
              video={continueWatching}
              onContinue={handlePlayVideo}
            />
          </section>
        )}

        {/* Required Videos */}
        {requiredVideos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Required Videos</h2>
            
            {allRequiredComplete ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">All required training complete!</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {requiredVideos.map((video) => (
                  <TrainingVideoCard
                    key={video.id}
                    video={video}
                    onPlay={handlePlayVideo}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* All Videos by Category */}
        {categories.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">All Videos</h2>
            <div className="space-y-4">
              {categories.map((category) => (
                <TrainingCategorySection
                  key={category.id}
                  name={category.name}
                  icon={category.icon}
                  videos={category.videos}
                  completedCount={category.completedCount}
                  onPlayVideo={handlePlayVideo}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {(!videos || videos.length === 0) && (
          <div className="text-center py-12">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No training videos available</h3>
            <p className="text-muted-foreground mt-1">
              Check back later for new training content.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
