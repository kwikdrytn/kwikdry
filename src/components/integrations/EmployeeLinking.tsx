import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Users, Link2, Unlink, Sparkles, Loader2 } from "lucide-react";

interface HCPEmployee {
  id: string;
  hcp_employee_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linked_user_id: string | null;
  linked_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface LocalProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
}

export function EmployeeLinking() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [linkingEmployeeId, setLinkingEmployeeId] = useState<string | null>(null);

  // Fetch HCP employees with linked profiles
  const { data: hcpEmployees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ['hcp-employees-with-links', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('hcp_employees')
        .select(`
          id,
          hcp_employee_id,
          name,
          email,
          phone,
          linked_user_id,
          linked_profile:profiles!hcp_employees_linked_user_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('name');
      
      if (error) throw error;
      return (data || []) as HCPEmployee[];
    },
    enabled: !!profile?.organization_id
  });

  // Fetch local profiles (technicians and admins) for linking
  const { data: localProfiles } = useQuery({
    queryKey: ['local-profiles-for-linking', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('first_name');
      
      if (error) throw error;
      return (data || []) as LocalProfile[];
    },
    enabled: !!profile?.organization_id
  });

  // Link employee mutation
  const linkEmployeeMutation = useMutation({
    mutationFn: async ({ employeeId, profileId }: { employeeId: string; profileId: string }) => {
      const { error } = await supabase
        .from('hcp_employees')
        .update({ linked_user_id: profileId })
        .eq('id', employeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setLinkingEmployeeId(null);
      refetchEmployees();
      queryClient.invalidateQueries({ queryKey: ['hcp-employees-with-links'] });
      toast({
        title: "Employee linked",
        description: "The HCP employee has been linked to a local profile",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to link",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Unlink employee mutation
  const unlinkEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from('hcp_employees')
        .update({ linked_user_id: null })
        .eq('id', employeeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEmployees();
      queryClient.invalidateQueries({ queryKey: ['hcp-employees-with-links'] });
      toast({
        title: "Employee unlinked",
        description: "The link has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unlink",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getProfileDisplayName = (profile: LocalProfile | null | undefined): string => {
    if (!profile) return '';
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    return name || profile.email || 'Unknown';
  };

  const getLinkedProfileName = (employee: HCPEmployee): string => {
    const linked = employee.linked_profile;
    if (!linked) return '';
    const name = [linked.first_name, linked.last_name].filter(Boolean).join(' ');
    return name || linked.email || 'Unknown';
  };

  // Find suggested profile based on email match
  const findSuggestedProfile = (employee: HCPEmployee): LocalProfile | null => {
    if (!employee.email || !localProfiles) return null;
    const normalizedEmail = employee.email.toLowerCase().trim();
    return localProfiles.find(p => 
      p.email?.toLowerCase().trim() === normalizedEmail
    ) || null;
  };

  // Get available profiles (not already linked to other employees)
  const getAvailableProfiles = (currentEmployeeId: string): LocalProfile[] => {
    if (!localProfiles || !hcpEmployees) return [];
    
    const linkedProfileIds = new Set(
      hcpEmployees
        .filter(e => e.id !== currentEmployeeId && e.linked_user_id)
        .map(e => e.linked_user_id)
    );
    
    return localProfiles.filter(p => !linkedProfileIds.has(p.id));
  };

  const handleLink = (employeeId: string, profileId: string) => {
    linkEmployeeMutation.mutate({ employeeId, profileId });
  };

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hcpEmployees || hcpEmployees.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No HCP employees synced yet</p>
        <p className="text-xs mt-1">
          Click "Sync Now" to fetch employees from HouseCall Pro
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Employee Linking
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          Link HouseCall Pro employees to local user profiles for job assignments
        </p>
      </div>

      <ScrollArea className="h-[300px] rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>HCP Employee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Linked User</TableHead>
              <TableHead className="w-[180px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hcpEmployees.map((employee) => {
              const suggestedProfile = findSuggestedProfile(employee);
              const isLinked = !!employee.linked_user_id;
              const availableProfiles = getAvailableProfiles(employee.id);
              const isLinking = linkingEmployeeId === employee.id;

              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    {employee.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {employee.email || '—'}
                  </TableCell>
                  <TableCell>
                    {isLinked ? (
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3 w-3 text-green-600" />
                        <span>{getLinkedProfileName(employee)}</span>
                      </div>
                    ) : suggestedProfile ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Sparkles className="h-3 w-3" />
                          Suggested
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {getProfileDisplayName(suggestedProfile)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isLinked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkEmployeeMutation.mutate(employee.id)}
                        disabled={unlinkEmployeeMutation.isPending}
                      >
                        {unlinkEmployeeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Unlink className="h-4 w-4 mr-1" />
                            Unlink
                          </>
                        )}
                      </Button>
                    ) : isLinking ? (
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(value) => handleLink(employee.id, value)}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {suggestedProfile && (
                              <SelectItem 
                                key={suggestedProfile.id} 
                                value={suggestedProfile.id}
                                className="font-medium"
                              >
                                ✨ {getProfileDisplayName(suggestedProfile)}
                              </SelectItem>
                            )}
                            {availableProfiles
                              .filter(p => p.id !== suggestedProfile?.id)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {getProfileDisplayName(p)}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLinkingEmployeeId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Auto-link if there's a suggestion
                          if (suggestedProfile) {
                            handleLink(employee.id, suggestedProfile.id);
                          } else {
                            setLinkingEmployeeId(employee.id);
                          }
                        }}
                        disabled={linkEmployeeMutation.isPending}
                      >
                        {linkEmployeeMutation.isPending && linkingEmployeeId === employee.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-1" />
                            {suggestedProfile ? 'Accept' : 'Link'}
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
