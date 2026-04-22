import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  MapPin,
  Phone,
  Save,
  StickyNote,
  User,
  DollarSign,
} from "lucide-react";
import {
  SCHEDULE_STATUSES,
  getStatusColor,
  getStatusLabel,
  normalizeStatus,
  useUpdateScheduleJob,
} from "@/hooks/useSchedule";
import { useTechnicians } from "@/hooks/useJobMap";
import type { HCPJob } from "@/hooks/useJobMap";

interface Props {
  job: HCPJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

const UNASSIGNED_VALUE = "__unassigned__";

export function JobDetailsPanel({ job, open, onOpenChange, canEdit }: Props) {
  const { data: technicians = [] } = useTechnicians();
  const update = useUpdateScheduleJob();

  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [tech, setTech] = useState<string>(UNASSIGNED_VALUE);
  const [status, setStatus] = useState<string>("scheduled");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (!job) return;
    setDate(job.scheduled_date ?? "");
    setStart(job.scheduled_time?.slice(0, 5) ?? "");
    setEnd(job.scheduled_end?.slice(0, 5) ?? "");
    setTech(job.technician_hcp_id ?? UNASSIGNED_VALUE);
    setStatus(normalizeStatus(job.status));
    setNewNote("");
  }, [job?.id]);

  if (!job) return null;

  const services = (job.services as { name?: string; price?: number; quantity?: number }[] | null) ?? [];
  const color = getStatusColor(status);

  const handleSave = () => {
    update.mutate(
      {
        hcpJobId: job.hcp_job_id,
        scheduledDate: date || undefined,
        scheduledTime: start || undefined,
        scheduledEnd: end || undefined,
        technicianHcpId: tech === UNASSIGNED_VALUE ? undefined : tech,
        status,
        notes: newNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewNote("");
        },
      },
    );
  };

  const existingNotes = typeof job.notes === "string"
    ? [job.notes]
    : Array.isArray(job.notes)
      ? job.notes.map((n) => n.content ?? "").filter(Boolean)
      : [];

  const mapsHref = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [job.address, job.city, job.state, job.zip].filter(Boolean).join(", "),
      )}`
    : undefined;

  const hcpHref = `https://pro.housecallpro.com/app/jobs/${job.hcp_job_id}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-xl">{job.customer_name ?? "Unknown customer"}</SheetTitle>
            <Badge
              variant="outline"
              style={{ color, borderColor: `${color}60`, backgroundColor: `${color}15` }}
            >
              {getStatusLabel(status)}
            </Badge>
          </div>
          <SheetDescription>Job ID: {job.hcp_job_id}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Address */}
          {job.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div>{job.address}</div>
                <div className="text-muted-foreground">
                  {[job.city, job.state, job.zip].filter(Boolean).join(", ")}
                </div>
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-xs hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Open in Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Schedule */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Schedule</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="d">Date</Label>
                <Input
                  id="d"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="s">Start</Label>
                <Input
                  id="s"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="e">End</Label>
                <Input
                  id="e"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div>
              <Label>
                <User className="h-3.5 w-3.5 inline mr-1" />
                Technician
              </Label>
              <Select value={tech} onValueChange={setTech} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Services</h3>
            {services.length === 0 ? (
              <div className="text-sm text-muted-foreground">No line items.</div>
            ) : (
              <ul className="space-y-1.5">
                {services.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm border rounded px-2 py-1.5"
                  >
                    <span className="truncate">
                      {s.name ?? "Item"}
                      {s.quantity && s.quantity > 1 ? ` × ${s.quantity}` : ""}
                    </span>
                    {s.price != null && (
                      <span className="tabular-nums text-muted-foreground">
                        ${(Number(s.price) / 100).toFixed(2)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {job.total_amount != null && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t font-medium">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> Total
                </span>
                <span className="tabular-nums">
                  $
                  {Number(job.total_amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <StickyNote className="h-4 w-4" /> Notes
            </h3>
            {existingNotes.length > 0 && (
              <ul className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {existingNotes.map((n, i) => (
                  <li
                    key={i}
                    className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note (will be saved when you click Save)..."
                rows={3}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6 pt-4 border-t sticky bottom-0 bg-background">
          <Button
            variant="outline"
            asChild
            className="gap-1"
          >
            <a href={hcpHref} target="_blank" rel="noreferrer">
              Open in HCP <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={update.isPending} className="gap-1 flex-1">
              <Save className="h-4 w-4" />
              {update.isPending ? "Saving..." : "Save changes"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
