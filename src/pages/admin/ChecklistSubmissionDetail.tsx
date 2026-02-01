import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSubmissionDetail, useUpdateSubmissionStatus, ChecklistItem } from "@/hooks/useChecklists";
import { 
  ArrowLeft, 
  Flag, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ChecklistSubmissionDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useSubmissionDetail(submissionId);
  const updateStatus = useUpdateSubmissionStatus();

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [adminNote, setAdminNote] = useState("");

  const submission = data?.submission;
  const responses = data?.responses || [];

  // Get all photos from responses
  const photos = responses.filter((r) => r.image_url).map((r) => ({
    url: r.image_url!,
    label: r.item_key,
  }));

  const handleFlagSubmission = async () => {
    if (!submissionId) return;
    await updateStatus.mutateAsync({
      submissionId,
      status: "flagged",
    });
  };

  const handleAddNote = () => {
    if (!adminNote.trim()) return;
    toast.success("Admin note would be saved");
    setAdminNote("");
  };

  const handlePrint = () => {
    window.print();
  };

  const openPhotoModal = (index: number) => {
    setCurrentPhotoIndex(index);
    setPhotoModalOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      complete: { className: "bg-success text-success-foreground", label: "Complete" },
      flagged: { className: "bg-destructive text-destructive-foreground", label: "Flagged" },
      partial: { className: "bg-warning text-warning-foreground", label: "Partial" },
    };
    const config = statusConfig[status || "complete"] || statusConfig.complete;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getResponseDisplay = (response: typeof responses[0], items: ChecklistItem[]) => {
    const item = items.find((i) => i.key === response.item_key);
    if (!item) return response.value;

    switch (item.type) {
      case "boolean":
        return response.value === "true" ? (
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-4 w-4" /> Yes
          </span>
        ) : (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-4 w-4" /> No
          </span>
        );
      default:
        return response.value || "—";
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Submission Detail" description="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!submission) {
    return (
      <DashboardLayout title="Submission Not Found" description="The requested submission could not be found">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Submission not found</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/checklists")}>
              Back to Checklists
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const items = Array.isArray(submission.items_json) 
    ? (submission.items_json as unknown as ChecklistItem[])
    : [];

  return (
    <DashboardLayout 
      title={`${submission.template_name} - ${submission.first_name} ${submission.last_name}`}
      description="Submission details"
    >
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate("/admin/checklists")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {submission.status !== "flagged" && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleFlagSubmission}
                disabled={updateStatus.isPending}
              >
                <Flag className="mr-2 h-4 w-4" />
                Flag for Follow-up
              </Button>
            )}
          </div>
        </div>

        {/* Submission Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{submission.template_name}</CardTitle>
                <CardDescription>
                  {submission.first_name} {submission.last_name}
                </CardDescription>
              </div>
              {getStatusBadge(submission.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Period Date</p>
                <p className="font-medium">{format(new Date(submission.period_date), "MMMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitted At</p>
                <p className="flex items-center gap-1 font-medium">
                  <Clock className="h-4 w-4" />
                  {format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline">
                  {submission.frequency === "daily" ? "Daily" : "Weekly"}
                </Badge>
              </div>
            </div>
            {submission.notes && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">Submission Notes</p>
                <p className="mt-1 text-sm text-muted-foreground">{submission.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Responses */}
        <Card>
          <CardHeader>
            <CardTitle>Responses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => {
              const response = responses.find((r) => r.item_key === item.key);
              const photoIndex = photos.findIndex((p) => p.label === item.key);

              return (
                <div 
                  key={item.key} 
                  className="rounded-lg border p-4 print:border-gray-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                          {index + 1}
                        </span>
                        <p className="font-medium">{item.label}</p>
                      </div>
                      {item.description && (
                        <p className="mt-1 ml-8 text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <div className="mt-2 ml-8">
                        <p className="text-sm">
                          {response ? getResponseDisplay(response, items) : <span className="text-muted-foreground">No response</span>}
                        </p>
                      </div>
                      {response?.notes && (
                        <div className="mt-2 ml-8 flex items-start gap-2 text-sm">
                          <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <p className="text-muted-foreground">{response.notes}</p>
                        </div>
                      )}
                    </div>
                    {response?.image_url && (
                      <button
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary print:hidden"
                        onClick={() => openPhotoModal(photoIndex)}
                      >
                        <img
                          src={response.image_url}
                          alt={`Photo for ${item.label}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-foreground/50 opacity-0 transition-opacity hover:opacity-100">
                          <ImageIcon className="h-6 w-6 text-primary-foreground" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Admin Notes */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Admin Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Add a note about this submission..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddNote} disabled={!adminNote.trim()}>
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Photo Modal */}
        <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{photos[currentPhotoIndex]?.label || "Photo"}</DialogTitle>
            </DialogHeader>
            <div className="relative">
              {photos.length > 0 && (
                <img
                  src={photos[currentPhotoIndex]?.url}
                  alt={photos[currentPhotoIndex]?.label}
                  className="w-full rounded-lg"
                />
              )}
              {photos.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {currentPhotoIndex + 1} of {photos.length}
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={photos[currentPhotoIndex]?.url} download target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
