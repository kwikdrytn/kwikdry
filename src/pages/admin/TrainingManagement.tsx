import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, ListVideo } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoFormDialog } from "@/components/training/admin/VideoFormDialog";
import { VideosTable } from "@/components/training/admin/VideosTable";
import { CategoryFormDialog } from "@/components/training/admin/CategoryFormDialog";
import { CategoriesList } from "@/components/training/admin/CategoriesList";
import { TeamProgressTab } from "@/components/training/admin/TeamProgressTab";
import { PlaylistImportDialog } from "@/components/training/admin/PlaylistImportDialog";
import {
  useAdminVideos,
  useAdminCategories,
  AdminTrainingVideo,
  TrainingCategoryAdmin,
} from "@/hooks/useAdminTraining";
import { useDebounce } from "@/hooks/useDebounce";

export default function TrainingManagement() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "videos";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  
  // Video dialog state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<AdminTrainingVideo | null>(null);
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TrainingCategoryAdmin | null>(null);
  
  // Playlist import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: videos, isLoading: videosLoading } = useAdminVideos(
    categoryFilter || null,
    debouncedSearch
  );
  const { data: categories, isLoading: categoriesLoading } = useAdminCategories();

  const handleAddVideo = () => {
    setEditingVideo(null);
    setVideoDialogOpen(true);
  };

  const handleEditVideo = (video: AdminTrainingVideo) => {
    setEditingVideo(video);
    setVideoDialogOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: TrainingCategoryAdmin) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  return (
    <DashboardLayout title="Training Management">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="progress">Team Progress</TabsTrigger>
            </TabsList>

            {activeTab === "videos" && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <ListVideo className="mr-2 h-4 w-4" />
                  Import Playlist
                </Button>
                <Button onClick={handleAddVideo}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Video
                </Button>
              </div>
            )}
            {activeTab === "categories" && (
              <Button onClick={handleAddCategory}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            )}
          </div>

          <TabsContent value="videos" className="mt-6 space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select 
                value={categoryFilter || "all"} 
                onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Videos table */}
            <VideosTable
              videos={videos || []}
              onEdit={handleEditVideo}
              isLoading={videosLoading}
            />
          </TabsContent>

          <TabsContent value="categories" className="mt-6">
            <CategoriesList
              categories={categories || []}
              onEdit={handleEditCategory}
              isLoading={categoriesLoading}
            />
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <TeamProgressTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Video Form Dialog */}
      <VideoFormDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        video={editingVideo}
        categories={categories || []}
      />

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
      />

      {/* Playlist Import Dialog */}
      <PlaylistImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        categories={categories || []}
      />
    </DashboardLayout>
  );
}
