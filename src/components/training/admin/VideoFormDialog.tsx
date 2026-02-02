import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AdminTrainingVideo,
  TrainingCategoryAdmin,
  useCreateVideo,
  useUpdateVideo,
  useDeleteVideo,
  extractYouTubeVideoId,
  fetchYouTubeMetadata,
  formatDurationInput,
  parseDurationInput,
} from "@/hooks/useAdminTraining";

interface VideoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video?: AdminTrainingVideo | null;
  categories: TrainingCategoryAdmin[];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "call_staff", label: "Call Staff" },
  { value: "technician", label: "Technician" },
];

export function VideoFormDialog({
  open,
  onOpenChange,
  video,
  categories,
}: VideoFormDialogProps) {
  const { toast } = useToast();
  const createVideo = useCreateVideo();
  const updateVideo = useUpdateVideo();
  const deleteVideo = useDeleteVideo();

  const isEditing = !!video;

  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [requiredForRoles, setRequiredForRoles] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  
  const [videoId, setVideoId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or video changes
  useEffect(() => {
    if (open) {
      if (video) {
        setYoutubeUrl(`https://youtube.com/watch?v=${video.youtube_video_id}`);
        setVideoId(video.youtube_video_id);
        setTitle(video.title);
        setDescription(video.description || "");
        setCategoryId(video.category_id || "");
        setDuration(formatDurationInput(video.duration_seconds));
        setIsRequired(video.is_required);
        setRequiredForRoles(video.required_for_roles || []);
        setIsActive(video.is_active);
        setThumbnailUrl(video.thumbnail_url || "");
        setFetchError(null);
      } else {
        resetForm();
      }
    }
  }, [open, video]);

  const resetForm = () => {
    setYoutubeUrl("");
    setVideoId(null);
    setTitle("");
    setDescription("");
    setCategoryId("");
    setDuration("");
    setIsRequired(false);
    setRequiredForRoles([]);
    setIsActive(true);
    setThumbnailUrl("");
    setFetchError(null);
  };

  const handleYoutubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    setFetchError(null);

    const extractedId = extractYouTubeVideoId(url);
    if (extractedId && extractedId !== videoId) {
      setVideoId(extractedId);
      setIsFetching(true);

      const metadata = await fetchYouTubeMetadata(extractedId);
      setIsFetching(false);

      if (metadata) {
        setTitle(metadata.title);
        setThumbnailUrl(metadata.thumbnail);
      } else {
        setFetchError("Could not fetch video info. Please enter title manually.");
        setThumbnailUrl(`https://img.youtube.com/vi/${extractedId}/hqdefault.jpg`);
      }
    } else if (!extractedId) {
      setVideoId(null);
      setThumbnailUrl("");
    }
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    if (checked) {
      setRequiredForRoles([...requiredForRoles, role]);
    } else {
      setRequiredForRoles(requiredForRoles.filter(r => r !== role));
    }
  };

  const handleSubmit = async () => {
    if (!videoId) {
      toast({
        title: "Invalid YouTube URL",
        description: "Please enter a valid YouTube video URL.",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a video title.",
        variant: "destructive",
      });
      return;
    }

    const formData = {
      title: title.trim(),
      description: description.trim(),
      youtube_video_id: videoId,
      thumbnail_url: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration_seconds: parseDurationInput(duration),
      category_id: categoryId || null,
      is_required: isRequired,
      required_for_roles: isRequired ? requiredForRoles : [],
      is_active: isActive,
    };

    try {
      if (isEditing && video) {
        await updateVideo.mutateAsync({ id: video.id, data: formData });
        toast({ title: "Video updated successfully" });
      } else {
        await createVideo.mutateAsync(formData);
        toast({ title: "Video added successfully" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save video. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!video) return;

    try {
      await deleteVideo.mutateAsync(video.id);
      toast({ title: "Video deleted successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete video. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isPending = createVideo.isPending || updateVideo.isPending || deleteVideo.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Video" : "Add Video"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* YouTube URL */}
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <Input
              id="youtube-url"
              placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
              value={youtubeUrl}
              onChange={(e) => handleYoutubeUrlChange(e.target.value)}
              onBlur={() => handleYoutubeUrlChange(youtubeUrl)}
            />
            {isFetching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching video info...
              </div>
            )}
            {fetchError && (
              <p className="text-sm text-amber-600">{fetchError}</p>
            )}
            {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-full max-w-xs rounded-md border"
            />
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the video"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (mm:ss)</Label>
            <Input
              id="duration"
              placeholder="5:32"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-active">Active</Label>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-required">Required Video</Label>
            <Switch
              id="is-required"
              checked={isRequired}
              onCheckedChange={setIsRequired}
            />
          </div>

          {/* Required for roles */}
          {isRequired && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label>Required For</Label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((role) => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={requiredForRoles.includes(role.value)}
                      onCheckedChange={(checked) =>
                        handleRoleToggle(role.value, checked === true)
                      }
                    />
                    <Label htmlFor={`role-${role.value}`} className="font-normal">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isPending} className="sm:mr-auto">
                  Delete Video
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the video from the training library. User progress will be preserved but the video will no longer be accessible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !videoId}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Add Video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
