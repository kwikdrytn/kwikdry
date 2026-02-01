import { useState } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  useChecklistSubmissions, 
  useTechnicians, 
  useMissingTodaySubmissions,
  useComplianceData,
  ChecklistSubmissionWithDetails 
} from "@/hooks/useChecklists";
import { useNavigate } from "react-router-dom";
import { 
  CalendarIcon, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Users,
  TrendingUp,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FrequencyFilter = "all" | "daily" | "weekly";

export default function ChecklistReview() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("submissions");
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>("all");
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const { data: submissions, isLoading: submissionsLoading } = useChecklistSubmissions({
    dateFrom,
    dateTo,
    technicianId: technicianFilter === "all" ? undefined : technicianFilter,
    frequency: frequencyFilter,
  });

  const { data: technicians } = useTechnicians();
  const { data: missingToday, isLoading: missingLoading } = useMissingTodaySubmissions();
  const { data: complianceData, isLoading: complianceLoading } = useComplianceData(30);

  const handleRowClick = (submission: ChecklistSubmissionWithDetails) => {
    navigate(`/admin/checklists/${submission.id}`);
  };

  const handleSendReminder = (technicianName: string) => {
    toast.success(`Reminder would be sent to ${technicianName}`);
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
    <DashboardLayout title="Checklist Review" description="Review and manage checklist submissions">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowMissingOnly(!showMissingOnly)}
                  >
                    {showMissingOnly ? "Show All" : "Show Only Missing"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
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
                </div>

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
            {/* Summary Cards */}
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
                        <TableHead></TableHead>
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
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendReminder(`${tech.first_name} ${tech.last_name}`)}
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
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
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  Template management coming soon.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  View and edit checklist templates.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
