import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel, normalizeStatus } from "@/hooks/useSchedule";
import type { HCPJob } from "@/hooks/useJobMap";
import { Clock, MapPin } from "lucide-react";

interface JobBlockProps {
  job: HCPJob;
  onClick: (job: HCPJob) => void;
  draggable?: boolean;
  style?: React.CSSProperties;
  compact?: boolean;
  conflict?: boolean;
}

export function JobBlock({ job, onClick, draggable = true, style, compact, conflict }: JobBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${job.id}`,
    data: { job },
    disabled: !draggable,
  });

  const color = getStatusColor(job.status);
  const status = normalizeStatus(job.status);
  const services = (job.services as { name?: string }[] | null) ?? [];
  const serviceText = services.map((s) => s.name).filter(Boolean).join(", ");

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: transform ? CSS.Translate.toString(transform) : style?.transform,
    opacity: isDragging ? 0.5 : style?.opacity ?? 1,
    borderLeftColor: color,
    borderLeftWidth: 4,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onClick(job);
      }}
      {...listeners}
      {...attributes}
      style={dragStyle}
      className={cn(
        "group w-full text-left rounded-md border bg-card hover:bg-accent/40 transition-colors shadow-sm overflow-hidden",
        "px-2 py-1.5 cursor-grab active:cursor-grabbing",
        conflict && "ring-2 ring-destructive",
        compact && "px-1.5 py-1",
      )}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs font-semibold truncate text-foreground">
          {job.customer_name ?? "Unknown customer"}
        </span>
        {!compact && (
          <span
            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {getStatusLabel(status)}
          </span>
        )}
      </div>
      {!compact && (
        <>
          {(job.scheduled_time || job.scheduled_end) && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span>
                {job.scheduled_time?.slice(0, 5)}
                {job.scheduled_end ? `–${job.scheduled_end.slice(0, 5)}` : ""}
              </span>
            </div>
          )}
          {serviceText && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{serviceText}</div>
          )}
          {job.address && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.address}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
