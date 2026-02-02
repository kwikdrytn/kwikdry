import { Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TrainingProgressSummaryProps {
  completedCount: number;
  totalCount: number;
}

export function TrainingProgressSummary({ completedCount, totalCount }: TrainingProgressSummaryProps) {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allComplete = completedCount === totalCount && totalCount > 0;

  return (
    <Card className={cn(
      "border-2",
      allComplete ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-primary/20"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
            allComplete ? "bg-green-500" : "bg-primary/10"
          )}>
            {allComplete ? (
              <Check className="h-6 w-6 text-white" />
            ) : (
              <AlertCircle className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {allComplete ? (
              <>
                <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
                  All required training complete!
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Great job! You've completed all {totalCount} required training videos.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">
                  {completedCount} of {totalCount} required videos completed
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete all required training to stay compliant.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
