import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompletedChecklistCard } from "@/components/checklists/CompletedChecklistCard";
import { ChecklistForm } from "@/components/checklists/ChecklistForm";
import { TemplateFormDialog } from "@/components/checklists/TemplateFormDialog";
import { 
  useChecklistTemplates, 
  useDailySubmission, 
  useWeeklySubmission,
  useSubmitChecklist,
  useChecklistSubmissions,
  useTechnicians,
  useMissingTodaySubmissions,
  useComplianceData,
  useAllChecklistTemplates,
  useDeleteTemplate,
  getWeekRange,
  ChecklistSubmissionWithDetails,
  ChecklistTemplate
} from "@/hooks/useChecklists";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Clock,
  CalendarIcon,
  AlertTriangle,
  Bell,
  Plus,
  Pencil,
  Trash2,
  FileText
} from "lucide-react";

type FrequencyFilter = "all" | "daily" | "weekly";

// Technician view component
function TechnicianChecklists() {
  const navigate = useNavigate();
  
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
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
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
          onClick={() => navigate("/checklists/weekly")}
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
  );
}

// Admin view component
function AdminChecklists() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("submissions");
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>("all");

  // Template management state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);

  const { data: submissions, isLoading: submissionsLoading } = useChecklistSubmissions({
    dateFrom,
    dateTo,
    technicianId: technicianFilter === "all" ? undefined : technicianFilter,
    frequency: frequencyFilter,
  });

  const { data: technicians } = useTechnicians();
  const { data: missingToday } = useMissingTodaySubmissions();
  const { data: complianceData, isLoading: complianceLoading } = useComplianceData(30);
  const { data: templates, isLoading: templatesLoading } = useAllChecklistTemplates();
  const deleteTemplate = useDeleteTemplate();

  const handleRowClick = (submission: ChecklistSubmissionWithDetails) => {
    navigate(`/checklists/${submission.id}`);
  };

  const handleEditTemplate = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = async (template: ChecklistTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      await deleteTemplate.mutateAsync(template.id);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateDialogOpen(true);
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

  const getRateColor = (rate: number) => {
    if (rate >= 95) return "text-success";
    if (rate >= 80) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="space-y-6">
          {/* Missing Today Alert */}
          {missingToday && missingToday.length > 0 && (
            <Card className="border-warning bg-warning/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Missing Today's Daily Checklist ({missingToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {missingToday.map((tech) => (
                    <Badge key={tech.id} variant="outline" className="border-warning">
                      {tech.first_name} {tech.last_name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "MMM d")} - {format(dateTo, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateFrom, to: dateTo }}
                    onSelect={(range) => {
                      if (range?.from) setDateFrom(range.from);
                      if (range?.to) setDateTo(range.to);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians?.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.first_name} {tech.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={frequencyFilter} onValueChange={(v) => setFrequencyFilter(v as FrequencyFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Submissions Table */}
          <Card>
            <CardContent className="p-0">
              {submissionsLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No submissions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      submissions?.map((submission) => (
                        <TableRow 
                          key={submission.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(submission)}
                        >
                          <TableCell>{format(new Date(submission.period_date), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            {submission.first_name} {submission.last_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {submission.frequency === "daily" ? "Daily" : "Weekly"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(submission.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(submission.submitted_at), "h:mm a")}
                          </TableCell>
                          <TableCell>
                            {submission.status === "flagged" && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          {complianceLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overall Daily Rate</CardDescription>
                  <CardTitle className={cn("text-3xl", getRateColor(complianceData?.summary.overallDailyRate || 0))}>
                    {complianceData?.summary.overallDailyRate.toFixed(1)}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Last 30 days ({complianceData?.summary.workDays} work days)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overall Weekly Rate</CardDescription>
                  <CardTitle className={cn("text-3xl", getRateColor(complianceData?.summary.overallWeeklyRate || 0))}>
                    {complianceData?.summary.overallWeeklyRate.toFixed(1)}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Last 30 days ({complianceData?.summary.weeks} weeks)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Perfect Compliance</CardDescription>
                  <CardTitle className="text-3xl text-success">
                    {complianceData?.summary.perfectCompliance}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    of {complianceData?.summary.totalTechnicians} technicians
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Compliance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Technician Compliance (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {complianceLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead>Daily Rate</TableHead>
                      <TableHead>Weekly Rate</TableHead>
                      <TableHead>Last Daily</TableHead>
                      <TableHead>Last Weekly</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceData?.technicians.map((tech) => (
                      <TableRow key={tech.id}>
                        <TableCell className="font-medium">
                          {tech.first_name} {tech.last_name}
                        </TableCell>
                        <TableCell>
                          <span className={getRateColor(tech.dailyRate)}>
                            {tech.dailyRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={getRateColor(tech.weeklyRate)}>
                            {tech.weeklyRate.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tech.lastDaily ? format(new Date(tech.lastDaily), "MMM d") : "Never"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tech.lastWeekly ? format(new Date(tech.lastWeekly), "MMM d") : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Checklist Templates</h3>
              <p className="text-sm text-muted-foreground">
                Create and manage checklist templates for technicians.
              </p>
            </div>
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          {templatesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : templates?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No templates yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first checklist template to get started.
                </p>
                <Button className="mt-4" onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates?.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {template.name}
                          {template.is_active ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {template.description || "No description"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {template.frequency === "daily" ? "Daily" : "Weekly"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {template.items_json.length} checklist item{template.items_json.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TemplateFormDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        template={editingTemplate}
      />
    </div>
  );
}

export default function Checklists() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isTechnician = profile?.role === 'technician';

  return (
    <DashboardLayout title="Checklists">
      {isAdmin ? (
        <AdminChecklists />
      ) : isTechnician ? (
        <TechnicianChecklists />
      ) : (
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Checklists are only available for technicians.
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
