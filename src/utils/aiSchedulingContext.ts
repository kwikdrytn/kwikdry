import { supabase } from '@/integrations/supabase/client';
import { SERVICE_TYPES } from '@/types/technician';

interface TechnicianSkillRow {
  id: string;
  service_type: string;
  skill_level: string;
  notes: string | null;
}

interface TechnicianNoteRow {
  id: string;
  note_type: string;
  note: string;
  is_active: boolean;
}

interface TechnicianWithContext {
  id: string;
  first_name: string | null;
  last_name: string | null;
  technician_skills: TechnicianSkillRow[];
  technician_notes: TechnicianNoteRow[];
}

// Helper to format service type for display
function formatServiceType(serviceType: string): string {
  const found = SERVICE_TYPES.find(s => s.value === serviceType);
  return found?.label || serviceType;
}

// Build context string for a single technician
export async function getTechnicianContext(profileId: string): Promise<string> {
  // Fetch profile with skills and notes
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      technician_skills(id, service_type, skill_level, notes),
      technician_notes(id, note_type, note, is_active)
    `)
    .eq('id', profileId)
    .single();

  if (error || !profile) return '';

  const tech = profile as unknown as TechnicianWithContext;
  
  let context = `## Technician: ${tech.first_name || ''} ${tech.last_name || ''}\n\n`;

  // Add skills section
  const skills = tech.technician_skills || [];
  if (skills.length > 0) {
    context += `### Service Assignment Preferences:\n`;
    
    // Group by skill level for clarity
    const preferred = skills.filter(s => s.skill_level === 'preferred');
    const avoid = skills.filter(s => s.skill_level === 'avoid');
    const never = skills.filter(s => s.skill_level === 'never');
    
    if (preferred.length > 0) {
      context += `**PREFERRED (prioritize these):**\n`;
      preferred.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    if (avoid.length > 0) {
      context += `**AVOID (only if necessary):**\n`;
      avoid.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    if (never.length > 0) {
      context += `**NEVER ASSIGN:**\n`;
      never.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    context += `\n`;
  }

  // Add notes section
  const notes = (tech.technician_notes || []).filter(n => n.is_active);
  if (notes.length > 0) {
    context += `### Scheduling Notes:\n`;
    notes.forEach(n => {
      context += `- [${n.note_type.toUpperCase()}] ${n.note}\n`;
    });
    context += `\n`;
  }

  return context;
}

// Build context for all technicians in an organization
export async function getAllTechniciansContext(organizationId: string): Promise<string> {
  const { data: technicians, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      technician_skills(id, service_type, skill_level, notes),
      technician_notes(id, note_type, note, is_active)
    `)
    .eq('organization_id', organizationId)
    .eq('role', 'technician')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('first_name');

  if (error || !technicians || technicians.length === 0) {
    return 'No technicians available.';
  }

  let context = '# Available Technicians\n\n';
  
  for (const tech of technicians as unknown as TechnicianWithContext[]) {
    const techContext = await buildTechnicianContextFromData(tech);
    context += techContext;
    context += '---\n\n';
  }

  return context;
}

// Build context from already-fetched data (avoids extra queries)
function buildTechnicianContextFromData(tech: TechnicianWithContext): string {
  let context = `## Technician: ${tech.first_name || ''} ${tech.last_name || ''}\n\n`;

  const skills = tech.technician_skills || [];
  if (skills.length > 0) {
    context += `### Service Assignment Preferences:\n`;
    
    const preferred = skills.filter(s => s.skill_level === 'preferred');
    const avoid = skills.filter(s => s.skill_level === 'avoid');
    const never = skills.filter(s => s.skill_level === 'never');
    
    if (preferred.length > 0) {
      context += `**PREFERRED (prioritize these):**\n`;
      preferred.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    if (avoid.length > 0) {
      context += `**AVOID (only if necessary):**\n`;
      avoid.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    if (never.length > 0) {
      context += `**NEVER ASSIGN:**\n`;
      never.forEach(s => {
        context += `- ${formatServiceType(s.service_type)}`;
        if (s.notes) context += ` - ${s.notes}`;
        context += `\n`;
      });
    }
    
    context += `\n`;
  }

  const notes = (tech.technician_notes || []).filter(n => n.is_active);
  if (notes.length > 0) {
    context += `### Scheduling Notes:\n`;
    notes.forEach(n => {
      context += `- [${n.note_type.toUpperCase()}] ${n.note}\n`;
    });
    context += `\n`;
  }

  return context;
}

// Use the database function directly (more efficient for large datasets)
export async function getTechnicianContextFromDB(profileId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_technician_scheduling_context', {
    tech_profile_id: profileId
  });
  
  if (error) {
    console.error('Error fetching technician context:', error);
    return '';
  }
  
  return data || '';
}

export async function getAllTechniciansContextFromDB(organizationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_all_technicians_scheduling_context', {
    org_id: organizationId
  });
  
  if (error) {
    console.error('Error fetching all technicians context:', error);
    return '';
  }
  
  return data || '';
}

// Summary helper for quick skill overview
export function summarizeTechnicianSkills(skills: TechnicianSkillRow[]): {
  preferred: string[];
  avoid: string[];
  never: string[];
  hasPreferences: boolean;
} {
  const preferred = skills
    .filter(s => s.skill_level === 'preferred')
    .map(s => formatServiceType(s.service_type));
  const avoid = skills
    .filter(s => s.skill_level === 'avoid')
    .map(s => formatServiceType(s.service_type));
  const never = skills
    .filter(s => s.skill_level === 'never')
    .map(s => formatServiceType(s.service_type));

  return {
    preferred,
    avoid,
    never,
    hasPreferences: preferred.length > 0 || avoid.length > 0 || never.length > 0,
  };
}
