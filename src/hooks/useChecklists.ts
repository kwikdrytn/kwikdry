import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, endOfWeek, format, startOfDay, endOfDay, subDays } from "date-fns";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type ChecklistFrequency = Database["public"]["Enums"]["checklist_frequency"];
type ChecklistStatus = Database["public"]["Enums"]["checklist_status"];

export interface ChecklistItem {
  key: string;
  label: string;
  type: "boolean" | "text" | "number" | "select" | "photo";
  required?: boolean;
  photo_required?: boolean;
  options?: string[];
  description?: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  frequency: ChecklistFrequency;
  items_json: ChecklistItem[];
  is_active: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistSubmission {
  id: string;
  template_id: string;
  technician_id: string;
  location_id: string;
  period_date: string;
  status: ChecklistStatus;
  notes: string | null;
  submitted_at: string;
}

export interface ChecklistSubmissionWithDetails extends ChecklistSubmission {
  template_name: string;
  frequency: ChecklistFrequency;
  first_name: string | null;
  last_name: string | null;
}

export interface ChecklistResponse {
  id: string;
  submission_id: string;
  item_key: string;
  value: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
}

export function getWeekRange(date: Date = new Date()) {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const sunday = endOfWeek(date, { weekStartsOn: 1 });
  return { monday, sunday };
}

export function useChecklistTemplates(frequency?: ChecklistFrequency) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["checklist-templates", profile?.organization_id, frequency],
    queryFn: async () => {
      let query = supabase
        .from("checklist_templates")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (frequency) {
        query = query.eq("frequency", frequency);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(template => ({
        ...template,
        items_json: Array.isArray(template.items_json) 
          ? (template.items_json as unknown as ChecklistItem[])
          : []
      })) as ChecklistTemplate[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useWeeklySubmission() {
  const { profile } = useAuth();
  const { monday, sunday } = getWeekRange();

  return useQuery({
    queryKey: ["weekly-submission", profile?.id, format(monday, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("checklist_submissions")
        .select(`
          *,
          checklist_templates!inner(frequency)
        `)
        .eq("technician_id", profile.id)
        .gte("period_date", format(monday, "yyyy-MM-dd"))
        .lte("period_date", format(sunday, "yyyy-MM-dd"))
        .eq("checklist_templates.frequency", "weekly")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as ChecklistSubmission | null;
    },
    enabled: !!profile?.id,
  });
}

export function useDailySubmission(date: Date = new Date()) {
  const { profile } = useAuth();
  const formattedDate = format(date, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["daily-submission", profile?.id, formattedDate],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("checklist_submissions")
        .select(`
          *,
          checklist_templates!inner(frequency)
        `)
        .eq("technician_id", profile.id)
        .eq("period_date", formattedDate)
        .eq("checklist_templates.frequency", "daily")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data as ChecklistSubmission | null;
    },
    enabled: !!profile?.id,
  });
}

export function useSubmitChecklist() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      templateId,
      responses,
      notes,
      periodDate,
    }: {
      templateId: string;
      responses: Record<string, { value: string; image_url?: string; notes?: string }>;
      notes?: string;
      periodDate: Date;
    }) => {
      if (!profile?.id || !profile?.location_id) {
        throw new Error("User profile or location not found");
      }

      // Create submission
      const { data: submission, error: submissionError } = await supabase
        .from("checklist_submissions")
        .insert({
          template_id: templateId,
          technician_id: profile.id,
          location_id: profile.location_id,
          period_date: format(periodDate, "yyyy-MM-dd"),
          status: "complete",
          notes,
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Create responses
      const responseRecords = Object.entries(responses).map(([itemKey, data]) => ({
        submission_id: submission.id,
        item_key: itemKey,
        value: data.value,
        image_url: data.image_url || null,
        notes: data.notes || null,
      }));

      const { error: responsesError } = await supabase
        .from("checklist_responses")
        .insert(responseRecords);

      if (responsesError) throw responsesError;

      return submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-submission"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-submission"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-submissions"] });
      toast.success("Checklist submitted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to submit checklist: ${error.message}`);
    },
  });
}

export function useChecklistSubmissions(filters: {
  dateFrom?: Date;
  dateTo?: Date;
  technicianId?: string;
  frequency?: ChecklistFrequency | "all";
}) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["checklist-submissions", profile?.organization_id, filters],
    queryFn: async () => {
      let query = supabase
        .from("checklist_submissions")
        .select(`
          *,
          checklist_templates!inner(name, frequency, organization_id),
          profiles!inner(first_name, last_name)
        `)
        .order("submitted_at", { ascending: false });

      if (filters.dateFrom) {
        query = query.gte("period_date", format(filters.dateFrom, "yyyy-MM-dd"));
      }
      if (filters.dateTo) {
        query = query.lte("period_date", format(filters.dateTo, "yyyy-MM-dd"));
      }
      if (filters.technicianId) {
        query = query.eq("technician_id", filters.technicianId);
      }
      if (filters.frequency && filters.frequency !== "all") {
        query = query.eq("checklist_templates.frequency", filters.frequency);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        template_id: item.template_id,
        technician_id: item.technician_id,
        location_id: item.location_id,
        period_date: item.period_date,
        status: item.status,
        notes: item.notes,
        submitted_at: item.submitted_at,
        template_name: item.checklist_templates?.name,
        frequency: item.checklist_templates?.frequency,
        first_name: item.profiles?.first_name,
        last_name: item.profiles?.last_name,
      })) as ChecklistSubmissionWithDetails[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useSubmissionDetail(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["submission-detail", submissionId],
    queryFn: async () => {
      if (!submissionId) return null;

      const { data: submission, error: submissionError } = await supabase
        .from("checklist_submissions")
        .select(`
          *,
          checklist_templates(name, frequency, items_json),
          profiles(first_name, last_name)
        `)
        .eq("id", submissionId)
        .single();

      if (submissionError) throw submissionError;

      const { data: responses, error: responsesError } = await supabase
        .from("checklist_responses")
        .select("*")
        .eq("submission_id", submissionId);

      if (responsesError) throw responsesError;

      return {
        submission: {
          ...submission,
          template_name: (submission as any).checklist_templates?.name,
          frequency: (submission as any).checklist_templates?.frequency,
          items_json: (submission as any).checklist_templates?.items_json,
          first_name: (submission as any).profiles?.first_name,
          last_name: (submission as any).profiles?.last_name,
        },
        responses: responses as ChecklistResponse[],
      };
    },
    enabled: !!submissionId,
  });
}

export function useUpdateSubmissionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      status,
    }: {
      submissionId: string;
      status: ChecklistStatus;
    }) => {
      const { error } = await supabase
        .from("checklist_submissions")
        .update({ status })
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submission-detail"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

export function useTechnicians() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["technicians", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, location_id")
        .eq("role", "technician")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useMissingTodaySubmissions() {
  const { profile } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["missing-today", profile?.organization_id, today],
    queryFn: async () => {
      // Get all active technicians
      const { data: technicians, error: techError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "technician")
        .eq("is_active", true)
        .is("deleted_at", null);

      if (techError) throw techError;

      // Get today's submissions
      const { data: submissions, error: subError } = await supabase
        .from("checklist_submissions")
        .select(`
          technician_id,
          checklist_templates!inner(frequency)
        `)
        .eq("period_date", today)
        .eq("checklist_templates.frequency", "daily");

      if (subError) throw subError;

      const submittedIds = new Set((submissions || []).map((s: any) => s.technician_id));
      const missing = (technicians || []).filter((t) => !submittedIds.has(t.id));

      return missing;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useComplianceData(days: number = 30) {
  const { profile } = useAuth();
  const endDate = new Date();
  const startDate = subDays(endDate, days);

  return useQuery({
    queryKey: ["compliance-data", profile?.organization_id, days],
    queryFn: async () => {
      // Get all technicians
      const { data: technicians, error: techError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "technician")
        .eq("is_active", true)
        .is("deleted_at", null);

      if (techError) throw techError;

      // Get all submissions in date range
      const { data: submissions, error: subError } = await supabase
        .from("checklist_submissions")
        .select(`
          technician_id,
          period_date,
          checklist_templates!inner(frequency)
        `)
        .gte("period_date", format(startDate, "yyyy-MM-dd"))
        .lte("period_date", format(endDate, "yyyy-MM-dd"));

      if (subError) throw subError;

      // Calculate work days (excluding weekends)
      let workDays = 0;
      let weeks = 0;
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workDays++;
        }
        if (dayOfWeek === 0) {
          weeks++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate compliance per technician
      const complianceMap = new Map<string, {
        dailyCount: number;
        weeklyCount: number;
        lastDaily: string | null;
        lastWeekly: string | null;
      }>();

      (technicians || []).forEach((tech) => {
        complianceMap.set(tech.id, {
          dailyCount: 0,
          weeklyCount: 0,
          lastDaily: null,
          lastWeekly: null,
        });
      });

      (submissions || []).forEach((sub: any) => {
        const techData = complianceMap.get(sub.technician_id);
        if (techData) {
          if (sub.checklist_templates?.frequency === "daily") {
            techData.dailyCount++;
            if (!techData.lastDaily || sub.period_date > techData.lastDaily) {
              techData.lastDaily = sub.period_date;
            }
          } else if (sub.checklist_templates?.frequency === "weekly") {
            techData.weeklyCount++;
            if (!techData.lastWeekly || sub.period_date > techData.lastWeekly) {
              techData.lastWeekly = sub.period_date;
            }
          }
        }
      });

      const complianceData = (technicians || []).map((tech) => {
        const data = complianceMap.get(tech.id)!;
        return {
          ...tech,
          dailyRate: workDays > 0 ? (data.dailyCount / workDays) * 100 : 0,
          weeklyRate: weeks > 0 ? (data.weeklyCount / weeks) * 100 : 0,
          dailyCount: data.dailyCount,
          weeklyCount: data.weeklyCount,
          lastDaily: data.lastDaily,
          lastWeekly: data.lastWeekly,
        };
      });

      // Calculate overall stats
      const totalDailySubmissions = complianceData.reduce((sum, t) => sum + t.dailyCount, 0);
      const totalWeeklySubmissions = complianceData.reduce((sum, t) => sum + t.weeklyCount, 0);
      const expectedDaily = workDays * technicians!.length;
      const expectedWeekly = weeks * technicians!.length;

      const overallDailyRate = expectedDaily > 0 ? (totalDailySubmissions / expectedDaily) * 100 : 0;
      const overallWeeklyRate = expectedWeekly > 0 ? (totalWeeklySubmissions / expectedWeekly) * 100 : 0;
      const perfectCompliance = complianceData.filter((t) => t.dailyRate >= 100 && t.weeklyRate >= 100).length;

      return {
        technicians: complianceData,
        summary: {
          overallDailyRate,
          overallWeeklyRate,
          perfectCompliance,
          totalTechnicians: technicians!.length,
          workDays,
          weeks,
        },
      };
    },
    enabled: !!profile?.organization_id,
  });
}

export function useAllChecklistTemplates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["all-checklist-templates", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      
      return (data || []).map(template => ({
        ...template,
        items_json: Array.isArray(template.items_json) 
          ? (template.items_json as unknown as ChecklistItem[])
          : []
      })) as ChecklistTemplate[];
    },
    enabled: !!profile?.organization_id,
  });
}

export interface TemplateFormData {
  name: string;
  description: string;
  frequency: ChecklistFrequency;
  items: ChecklistItem[];
  is_active: boolean;
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { data: template, error } = await supabase
        .from("checklist_templates")
        .insert({
          name: data.name,
          description: data.description || null,
          frequency: data.frequency,
          items_json: data.items as any,
          is_active: data.is_active,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Template created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormData> }) => {
      const updateData: Record<string, any> = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.frequency !== undefined) updateData.frequency = data.frequency;
      if (data.items !== undefined) updateData.items_json = data.items as any;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      const { data: template, error } = await supabase
        .from("checklist_templates")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Template updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checklist_templates")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-checklist-templates"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Template deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}
