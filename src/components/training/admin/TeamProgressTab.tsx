import { useState } from "react";
import { format } from "date-fns";
import {
  Video,
  Star,
  Users,
  ChevronDown,
  ChevronRight,
  Bell,
  Download,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  TeamProgressSummary,
  TeamMemberProgress,
  useTeamProgress,
} from "@/hooks/useAdminTraining";

function getProgressColor(percent: number): string {
  if (percent < 50) return "text-red-500";
  if (percent < 80) return "text-yellow-500";
  return "text-green-500";
}

function getProgressBarColor(percent: number): string {
  if (percent < 50) return "bg-red-500";
  if (percent < 80) return "bg-yellow-500";
  return "bg-green-500";
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case "technician":
      return "Technician";
    case "call_staff":
      return "Call Staff";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

function SummaryCards({ data }: { data: TeamProgressSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
          <Video className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_videos}</div>
          <p className="text-xs text-muted-foreground">
            Active training videos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Required Videos</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.required_videos}</div>
          <p className="text-xs text-muted-foreground">
            Mandatory for team members
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Team Completion Rate</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getProgressColor(data.team_completion_rate)}`}>
            {data.team_completion_rate}%
          </div>
          <p className="text-xs text-muted-foreground">
            Required videos completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface TeamMemberRowProps {
  member: TeamMemberProgress;
  onSendReminder: (member: TeamMemberProgress) => void;
}

function TeamMemberRow({ member, onSendReminder }: TeamMemberRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="group">
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-medium">{fullName}</TableCell>
        <TableCell>
          <Badge variant="secondary">{formatRoleLabel(member.role)}</Badge>
        </TableCell>
        <TableCell className="text-center">{member.required_count}</TableCell>
        <TableCell className="text-center">{member.completed_count}</TableCell>
        <TableCell>
          <div className="flex items-center gap-3 min-w-[120px]">
            <Progress
              value={member.progress_percent}
              className="h-2 flex-1"
              style={{
                ["--progress-background" as string]: member.progress_percent < 50 
                  ? "hsl(0, 84%, 60%)" 
                  : member.progress_percent < 80 
                    ? "hsl(48, 96%, 53%)" 
                    : "hsl(142, 71%, 45%)",
              }}
            />
            <span className={`text-sm font-medium ${getProgressColor(member.progress_percent)}`}>
              {member.progress_percent}%
            </span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {member.last_activity
            ? format(new Date(member.last_activity), "MMM d, yyyy")
            : "Never"}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSendReminder(member)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-muted/30 px-8 py-4 border-t">
              <h4 className="text-sm font-medium mb-3">Required Videos</h4>
              {member.required_videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No required videos for this role.
                </p>
              ) : (
                <div className="space-y-2">
                  {member.required_videos.map((video) => (
                    <div
                      key={video.video_id}
                      className="flex items-center gap-3 text-sm"
                    >
                      {video.is_completed ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : video.progress_percent > 0 ? (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1">{video.title}</span>
                      {!video.is_completed && video.progress_percent > 0 && (
                        <span className="text-muted-foreground">
                          {video.progress_percent}% complete
                        </span>
                      )}
                      {video.is_completed && (
                        <Badge variant="outline" className="border-primary text-primary">
                          Completed
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

function exportToCSV(data: TeamProgressSummary) {
  const headers = ["Name", "Role", "Required Videos", "Completed", "Progress %", "Last Activity"];
  const rows = data.members.map((member) => {
    const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown";
    return [
      fullName,
      formatRoleLabel(member.role),
      member.required_count.toString(),
      member.completed_count.toString(),
      `${member.progress_percent}%`,
      member.last_activity
        ? format(new Date(member.last_activity), "yyyy-MM-dd")
        : "Never",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `team-training-progress-${format(new Date(), "yyyy-MM-dd")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TeamProgressTab() {
  const { toast } = useToast();
  const { data, isLoading } = useTeamProgress();

  const handleSendReminder = (member: TeamMemberProgress) => {
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "this user";
    toast({
      title: "Reminder feature coming soon",
      description: `Push notification reminders for ${name} will be available in a future update.`,
    });
  };

  const handleExport = () => {
    if (data) {
      exportToCSV(data);
      toast({
        title: "Export successful",
        description: "Team progress report has been downloaded.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load team progress data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCards data={data} />

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExport} disabled={data.members.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {data.members.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No team members found</h3>
          <p className="text-muted-foreground">
            Add technicians or call staff to track their training progress.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Team Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Required</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="w-[180px]">Progress</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((member) => (
                <TeamMemberRow
                  key={member.profile_id}
                  member={member}
                  onSendReminder={handleSendReminder}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
