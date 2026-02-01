import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

interface CompletedChecklistCardProps {
  submittedAt: string;
  status: string;
  notes?: string | null;
  periodLabel: string;
}

export function CompletedChecklistCard({ 
  submittedAt, 
  status, 
  notes, 
  periodLabel 
}: CompletedChecklistCardProps) {
  const statusColors: Record<string, string> = {
    complete: "bg-success text-success-foreground",
    flagged: "bg-destructive text-destructive-foreground",
    partial: "bg-warning text-warning-foreground",
  };

  return (
    <Card className="border-success/50 bg-success/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-6 w-6 text-success" />
          Checklist Completed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Period</span>
          <span className="font-medium">{periodLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Submitted</span>
          <span className="flex items-center gap-1 text-sm">
            <Clock className="h-4 w-4" />
            {format(parseISO(submittedAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge className={statusColors[status] || "bg-muted"}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        {notes && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Notes</p>
            <p className="mt-1 text-sm text-muted-foreground">{notes}</p>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          You've already submitted your checklist for this period. Great job!
        </p>
      </CardContent>
    </Card>
  );
}
