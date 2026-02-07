import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { HCPJob } from "@/hooks/useJobMap";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, X } from "lucide-react";

interface EditJobDialogProps {
  job: HCPJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JOB_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function EditJobDialog({ job, open, onOpenChange }: EditJobDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Load technicians
  const { data: technicians } = useQuery({
    queryKey: ["edit-job-technicians", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("hcp_employees")
        .select("hcp_employee_id, name")
        .eq("organization_id", profile.organization_id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id && open,
  });

  // Load services from price book
  const { data: availableServices } = useQuery({
    queryKey: ["edit-job-services", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("hcp_services")
        .select("name")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data?.map((s) => s.name) || [];
    },
    enabled: !!profile?.organization_id && open,
  });

  // Populate form when job changes
  useEffect(() => {
    if (!job) return;
    setScheduledDate(job.scheduled_date || "");
    setScheduledTime(job.scheduled_time?.substring(0, 5) || "");
    setScheduledEnd(job.scheduled_end?.substring(0, 5) || "");
    setTechnicianId(job.technician_hcp_id || "");
    setStatus(
      (job.status || "scheduled").toLowerCase().replace(/\s+/g, "_")
    );
    setNotes("");

    // Extract service names from job
    const services = (job.total_items || job.services) as
      | { name?: string }[]
      | null;
    setSelectedServices(
      services?.map((s) => s.name || "").filter(Boolean) || []
    );
  }, [job]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!job || !profile?.organization_id) throw new Error("Missing data");

      const { data, error } = await supabase.functions.invoke(
        "update-hcp-job",
        {
          body: {
            organizationId: profile.organization_id,
            hcpJobId: job.hcp_job_id,
            scheduledDate: scheduledDate || undefined,
            scheduledTime: scheduledTime || undefined,
            scheduledEnd: scheduledEnd || undefined,
            technicianHcpId: technicianId && technicianId !== "unassigned" ? technicianId : undefined,
            status: status || undefined,
            notes: notes.trim() || undefined,
            services:
              selectedServices.length > 0 ? selectedServices : undefined,
          },
        }
      );

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Update failed");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Job updated",
        description: "Changes saved to HouseCall Pro",
      });
      queryClient.invalidateQueries({ queryKey: ["job-map-jobs-range"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddService = (serviceName: string) => {
    if (!selectedServices.includes(serviceName)) {
      setSelectedServices([...selectedServices, serviceName]);
    }
  };

  const handleRemoveService = (serviceName: string) => {
    setSelectedServices(selectedServices.filter((s) => s !== serviceName));
  };

  if (!job) return null;

  const hcpUrl = `https://pro.housecallpro.com/pro/jobs/${job.hcp_job_id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Edit Job</span>
            <a
              href={hcpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-normal text-primary hover:underline inline-flex items-center gap-1"
            >
              Open in HCP <ExternalLink className="h-3 w-3" />
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Customer info (read-only) */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">
              {job.customer_name || "Unknown Customer"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[job.address, job.city, job.state, job.zip]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start</Label>
              <Input
                id="edit-start"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End</Label>
              <Input
                id="edit-end"
                type="time"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Technician */}
          <div className="space-y-1.5">
            <Label>Technician</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {technicians?.map((t) => (
                  <SelectItem key={t.hcp_employee_id} value={t.hcp_employee_id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Services */}
          <div className="space-y-1.5">
            <Label>Services</Label>
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedServices.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => handleRemoveService(s)}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {availableServices && availableServices.length > 0 && (
              <Select
                value=""
                onValueChange={(val) => {
                  if (val) handleAddService(val);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add a service…" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices
                    .filter((s) => !selectedServices.includes(s))
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Add Note</Label>
            <Textarea
              id="edit-notes"
              placeholder="Add a note to this job…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
