import { format, formatDistanceToNow } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, XCircle, CalendarClock, UserRoundX, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useActivityFeed, useMarkAsRead, useMarkAllAsRead, JobChangeEvent } from "@/hooks/useActivityFeed";
import { useState } from "react";
import { cn } from "@/lib/utils";

const changeTypeConfig: Record<string, { label: string; icon: typeof XCircle; color: string }> = {
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-destructive' },
  rescheduled: { label: 'Rescheduled', icon: CalendarClock, color: 'text-warning' },
  reassigned: { label: 'Reassigned', icon: UserRoundX, color: 'text-primary' },
};

function ChangeEventCard({ event, onMarkRead }: { event: JobChangeEvent; onMarkRead: (id: string) => void }) {
  const config = changeTypeConfig[event.change_type] || changeTypeConfig.cancelled;
  const Icon = config.icon;

  const getDescription = () => {
    switch (event.change_type) {
      case 'cancelled':
        return `Job for ${event.customer_name || 'Unknown'} was cancelled`;
      case 'rescheduled': {
        const oldDate = event.old_value?.scheduled_date;
        const newDate = event.new_value?.scheduled_date;
        const oldTime = event.old_value?.scheduled_time;
        const newTime = event.new_value?.scheduled_time;
        const parts: string[] = [];
        if (oldDate && newDate && oldDate !== newDate) parts.push(`${oldDate} → ${newDate}`);
        if (oldTime && newTime && oldTime !== newTime) parts.push(`${oldTime.slice(0, 5)} → ${newTime.slice(0, 5)}`);
        return `Job for ${event.customer_name || 'Unknown'} was rescheduled${parts.length ? ': ' + parts.join(', ') : ''}`;
      }
      case 'reassigned': {
        const oldTech = event.old_value?.technician_name || 'Unknown';
        const newTech = event.new_value?.technician_name || 'Unknown';
        return `Job for ${event.customer_name || 'Unknown'} reassigned: ${oldTech} → ${newTech}`;
      }
      default:
        return 'Job changed';
    }
  };

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-lg border p-4 transition-colors",
      !event.is_read && "bg-primary/5 border-primary/20"
    )}>
      <div className={cn("mt-0.5 shrink-0", config.color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{getDescription()}</p>
          {!event.is_read && (
            <Button variant="ghost" size="sm" className="shrink-0 h-7 text-xs" onClick={() => onMarkRead(event.id)}>
              <Check className="h-3 w-3 mr-1" /> Read
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs capitalize">{config.label}</Badge>
          {event.technician_name && <span>• {event.technician_name}</span>}
          <span>• {formatDistanceToNow(new Date(event.detected_at), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeedPage() {
  const [filter, setFilter] = useState('all');
  const { data: events, isLoading } = useActivityFeed(filter);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = events?.filter(e => !e.is_read).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Activity Feed
            </h1>
            <p className="text-muted-foreground text-sm">Job cancellations, reschedules, and reassignments from HCP</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Changes</SelectItem>
                <SelectItem value="cancelled">Cancellations</SelectItem>
                <SelectItem value="rescheduled">Reschedules</SelectItem>
                <SelectItem value="reassigned">Reassignments</SelectItem>
              </SelectContent>
            </Select>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
                <CheckCheck className="mr-1 h-4 w-4" />
                Mark All Read ({unreadCount})
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !events?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No job changes detected yet</p>
                <p className="text-sm text-muted-foreground mt-1">Changes will appear here after the next HCP sync</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(event => (
                  <ChangeEventCard key={event.id} event={event} onMarkRead={(id) => markAsRead.mutate(id)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
