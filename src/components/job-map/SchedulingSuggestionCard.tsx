import { format, parseISO } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  Target,
  Lightbulb, 
  ExternalLink, 
  Check, 
  Loader2,
  AlertCircle,
  Edit2,
  RotateCcw,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchedulingSuggestion } from "@/types/scheduling";

interface SchedulingSuggestionCardProps {
  suggestion: SchedulingSuggestion;
  onCreateJob: (suggestion: SchedulingSuggestion) => Promise<void>;
  onModify: (suggestion: SchedulingSuggestion) => void;
  onRetry?: (suggestion: SchedulingSuggestion) => void;
  isDisabled?: boolean;
}

function formatTime(time: string): string {
  try {
    return format(parseISO(`2000-01-01T${time}:00`), "h:mm a");
  } catch {
    return time;
  }
}

function formatDate(date: string): string {
  try {
    return format(parseISO(date), "MMM d, yyyy");
  } catch {
    return date;
  }
}

export function SchedulingSuggestionCard({ 
  suggestion, 
  onCreateJob, 
  onModify,
  onRetry,
  isDisabled = false,
}: SchedulingSuggestionCardProps) {
  const status = suggestion.status || 'pending';
  
  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case "high":
        return (
          <Badge className="bg-success/20 text-success hover:bg-success/20 text-[10px] px-1.5 py-0 border-0">
            <span className="mr-1">●●●</span>
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-warning/20 text-warning hover:bg-warning/20 text-[10px] px-1.5 py-0 border-0">
            <span className="mr-1">●●○</span>
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-muted text-muted-foreground hover:bg-muted text-[10px] px-1.5 py-0 border-0">
            <span className="mr-1">●○○</span>
            Low
          </Badge>
        );
    }
  };

  const getSkillMatchBadge = () => {
    if (!suggestion.skillMatch) return null;
    
    switch (suggestion.skillMatch) {
      case "preferred":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-success border-success/30">
            Preferred skill
          </Badge>
        );
      case "avoid":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning border-warning/30">
            Non-preferred
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleCreateJob = async () => {
    await onCreateJob(suggestion);
  };

  const handleRetry = () => {
    onRetry?.(suggestion);
  };

  return (
    <div
      className={cn(
        "border rounded-xl p-3 transition-all duration-200",
        status === 'created' && "border-success/50 bg-success/5 shadow-sm shadow-success/10",
        status === 'error' && "border-destructive/50 bg-destructive/5",
        status === 'creating' && "opacity-70 pointer-events-none",
        status === 'pending' && "bg-card hover:shadow-md hover:border-primary/30"
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {status === 'created' ? (
            <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-success" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-3 w-3 text-primary" />
            </div>
          )}
          <span className="text-xs font-medium">
            {status === 'created' ? 'Job Created' : 'Recommended Assignment'}
          </span>
        </div>
        {getConfidenceBadge(suggestion.confidence)}
      </div>

      {/* Service Type - Prominent */}
      <div className="text-sm font-semibold text-foreground mb-1.5">
        {suggestion.serviceType}
      </div>
      
      {/* Customer Name */}
      <div className="text-xs text-muted-foreground mb-2">
        Customer: <span className="text-foreground font-medium">{suggestion.customerName}</span>
      </div>
      
      {/* Address */}
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-1.5">
        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span className="leading-relaxed">
          {suggestion.address}, {suggestion.city}, {suggestion.state}
          {suggestion.zip && ` ${suggestion.zip}`}
        </span>
      </div>
      
      {/* Date/Time Row */}
      <div className="flex items-center gap-3 text-xs mb-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(suggestion.scheduledDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTime(suggestion.scheduledTime)}</span>
        </div>
        {suggestion.duration && (
          <span className="text-muted-foreground/70 text-[10px]">
            ({suggestion.duration} min)
          </span>
        )}
      </div>
      
      {/* Assigned Technician */}
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-2">
        <User className="h-3.5 w-3.5" />
        <span>→ Assign to: {suggestion.technicianName}</span>
        {getSkillMatchBadge()}
      </div>

      {/* Nearby Jobs Info */}
      {suggestion.nearbyJobsCount !== undefined && suggestion.nearbyJobsCount > 0 && (
        <div className="text-[10px] text-muted-foreground mb-2">
          📍 {suggestion.nearbyJobsCount} nearby job{suggestion.nearbyJobsCount > 1 ? 's' : ''} on this date
          {suggestion.nearestExistingJob && (
            <span className="ml-1">• Nearest: {suggestion.nearestExistingJob}</span>
          )}
        </div>
      )}
      
      {/* AI Reasoning Box */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2 mb-3">
        <Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
        <div>
          <span className="font-medium text-foreground/80">Why this recommendation: </span>
          <span className="leading-relaxed">{suggestion.reasoning}</span>
        </div>
      </div>

      {/* Error Message */}
      {status === 'error' && suggestion.error && (
        <div className="flex items-start gap-1.5 text-[10px] text-destructive bg-destructive/10 rounded-lg p-2 mb-3">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{suggestion.error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {status === 'pending' && (
          <>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs font-medium"
              onClick={handleCreateJob}
              disabled={isDisabled}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Create Job
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-3"
              onClick={() => onModify(suggestion)}
              disabled={isDisabled}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              Modify
            </Button>
          </>
        )}
        
        {status === 'creating' && (
          <div className="flex-1 flex items-center justify-center h-8 text-xs text-muted-foreground bg-muted/50 rounded-md">
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            Creating job...
          </div>
        )}
        
        {status === 'created' && suggestion.hcpJobUrl && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs font-medium text-success border-success/30 hover:bg-success/10 hover:text-success"
            asChild
          >
            <a href={suggestion.hcpJobUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View in HouseCall Pro
            </a>
          </Button>
        )}
        
        {status === 'error' && (
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 h-8 text-xs font-medium"
            onClick={handleRetry}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
