import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CompletedChecklistCard } from "@/components/checklists/CompletedChecklistCard";
import { ChecklistForm } from "@/components/checklists/ChecklistForm";
import { 
  useChecklistTemplates, 
  useDailySubmission, 
  useWeeklySubmission,
  useSubmitChecklist,
  getWeekRange
} from "@/hooks/useChecklists";
import { format } from "date-fns";
import { ClipboardCheck, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Checklists() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const { data: dailyTemplates, isLoading: dailyLoading } = useChecklistTemplates("daily");
  const { data: dailySubmission, isLoading: dailySubLoading } = useDailySubmission();
  const { data: weeklySubmission, isLoading: weeklySubLoading } = useWeeklySubmission();
  const submitChecklist = useSubmitChecklist();

  const { monday, sunday } = getWeekRange();
  const weekRange = `${format(monday, "MMM d")} - ${format(sunday, "MMM d")}`;
  const today = format(new Date(), "MMMM d, yyyy");

  const dailyTemplate = dailyTemplates?.[0];
  const isLoading = dailyLoading || dailySubLoading || weeklySubLoading;

  const handleDailySubmit = async (
    responses: Record<string, { value: string; image_url?: string; notes?: string }>,
    notes?: string
  ) => {
    if (!dailyTemplate) return;

    await submitChecklist.mutateAsync({
      templateId: dailyTemplate.id,
      responses,
      notes,
      periodDate: new Date(),
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Checklists" description="Complete your daily and weekly inspections">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Checklists" description="Complete your daily and weekly inspections">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Daily Status Card */}
          <Card className={dailySubmission ? "border-success/50 bg-success/5" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Daily Checklist</CardTitle>
                {dailySubmission ? (
                  <Badge className="bg-success text-success-foreground">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning text-warning">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{today}</p>
              {dailySubmission && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted at {format(new Date(dailySubmission.submitted_at), "h:mm a")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weekly Status Card */}
          <Card 
            className={`cursor-pointer transition-shadow hover:shadow-md ${weeklySubmission ? "border-success/50 bg-success/5" : ""}`}
            onClick={() => navigate("/technician/checklist/weekly")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Weekly Checklist</CardTitle>
                {weeklySubmission ? (
                  <Badge className="bg-success text-success-foreground">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning text-warning">
                    <Clock className="mr-1 h-3 w-3" />
                    Due Friday
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{weekRange}</p>
              {weeklySubmission ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted at {format(new Date(weeklySubmission.submitted_at), "h:mm a")}
                </p>
              ) : (
                <Button variant="link" className="mt-1 h-auto p-0 text-xs">
                  Go to weekly checklist →
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Checklist Form */}
        {!dailySubmission && dailyTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>{dailyTemplate.name}</CardTitle>
              {dailyTemplate.description && (
                <CardDescription>{dailyTemplate.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ChecklistForm
                items={dailyTemplate.items_json}
                onSubmit={handleDailySubmit}
                isSubmitting={submitChecklist.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* Already submitted daily */}
        {dailySubmission && (
          <CompletedChecklistCard
            submittedAt={dailySubmission.submitted_at}
            status={dailySubmission.status || "complete"}
            notes={dailySubmission.notes}
            periodLabel={today}
          />
        )}

        {/* No template configured */}
        {!dailySubmission && !dailyTemplate && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <ClipboardCheck className="h-8 w-8 text-accent-foreground" />
              </div>
              <p className="text-muted-foreground">
                No daily checklist template has been configured.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
