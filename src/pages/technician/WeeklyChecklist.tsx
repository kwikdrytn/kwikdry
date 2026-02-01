import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ChecklistForm } from "@/components/checklists/ChecklistForm";
import { CompletedChecklistCard } from "@/components/checklists/CompletedChecklistCard";
import { 
  useChecklistTemplates, 
  useWeeklySubmission, 
  useSubmitChecklist,
  getWeekRange 
} from "@/hooks/useChecklists";
import { format } from "date-fns";
import { Calendar, AlertTriangle } from "lucide-react";

export default function WeeklyChecklist() {
  const { data: templates, isLoading: templatesLoading } = useChecklistTemplates("weekly");
  const { data: existingSubmission, isLoading: submissionLoading } = useWeeklySubmission();
  const submitChecklist = useSubmitChecklist();

  const { monday, sunday } = getWeekRange();
  const weekRange = `${format(monday, "MMM d")} - ${format(sunday, "MMM d, yyyy")}`;
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isFriday = dayOfWeek === 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const weeklyTemplate = templates?.[0];
  const isLoading = templatesLoading || submissionLoading;

  const handleSubmit = async (
    responses: Record<string, { value: string; image_url?: string; notes?: string }>,
    notes?: string
  ) => {
    if (!weeklyTemplate) return;

    await submitChecklist.mutateAsync({
      templateId: weeklyTemplate.id,
      responses,
      notes,
      periodDate: monday,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Weekly Checklist" description="Complete your weekly inspection">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Weekly Checklist" description="Complete your weekly inspection">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Week indicator */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">This Week</CardTitle>
              </div>
              <Badge variant="outline">{weekRange}</Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Reminder alert */}
        {!existingSubmission && !isWeekend && (
          <Alert variant={isFriday ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {isFriday ? "Due Today!" : "Weekly Checklist Due"}
            </AlertTitle>
            <AlertDescription>
              {isFriday 
                ? "Your weekly checklist is due by end of day today (Friday)."
                : "Your weekly checklist is due by end of Friday."}
            </AlertDescription>
          </Alert>
        )}

        {/* Already submitted */}
        {existingSubmission && (
          <CompletedChecklistCard
            submittedAt={existingSubmission.submitted_at}
            status={existingSubmission.status || "complete"}
            notes={existingSubmission.notes}
            periodLabel={weekRange}
          />
        )}

        {/* Checklist form */}
        {!existingSubmission && weeklyTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>{weeklyTemplate.name}</CardTitle>
              {weeklyTemplate.description && (
                <CardDescription>{weeklyTemplate.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ChecklistForm
                items={weeklyTemplate.items_json}
                onSubmit={handleSubmit}
                isSubmitting={submitChecklist.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* No template configured */}
        {!existingSubmission && !weeklyTemplate && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                No weekly checklist template has been configured.
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
