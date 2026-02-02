import { useState } from "react";
import { Loader2, ListVideo } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useImportPlaylist, TrainingCategoryAdmin } from "@/hooks/useAdminTraining";

interface PlaylistImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TrainingCategoryAdmin[];
}

export function PlaylistImportDialog({
  open,
  onOpenChange,
  categories,
}: PlaylistImportDialogProps) {
  const { toast } = useToast();
  const importPlaylist = useImportPlaylist();

  const [playlistUrl, setPlaylistUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");

  const handleImport = async () => {
    if (!playlistUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube playlist URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await importPlaylist.mutateAsync({
        playlistUrl: playlistUrl.trim(),
        categoryId: categoryId === "none" ? undefined : categoryId,
      });

      toast({
        title: "Import complete",
        description: result.message,
      });
      
      setPlaylistUrl("");
      setCategoryId("none");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import playlist",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListVideo className="h-5 w-5" />
            Import YouTube Playlist
          </DialogTitle>
          <DialogDescription>
            Import all videos from a YouTube playlist at once. Duplicates will be skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="playlist-url">Playlist URL</Label>
            <Input
              id="playlist-url"
              placeholder="https://youtube.com/playlist?list=..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign to Category (optional)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importPlaylist.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importPlaylist.isPending || !playlistUrl.trim()}
          >
            {importPlaylist.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Import Videos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
