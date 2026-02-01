import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Save,
  Zap
} from "lucide-react";

interface HCPConnectionResult {
  success: boolean;
  company_name?: string;
  error?: string;
}

interface SyncCounts {
  jobs: number;
  customers: number;
  serviceZones: number;
}

export default function IntegrationSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch organization data
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization-integration', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, hcp_api_key, hcp_company_id')
        .eq('id', profile.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Set initial values
      if (data) {
        setApiKey(data.hcp_api_key || "");
        setCompanyId(data.hcp_company_id || "");
      }
      
      return data;
    },
    enabled: !!profile?.organization_id
  });

  // Fetch sync counts
  const { data: syncCounts } = useQuery({
    queryKey: ['hcp-sync-counts', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const [jobsResult, customersResult, zonesResult] = await Promise.all([
        supabase.from('hcp_jobs').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase.from('hcp_customers').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase.from('hcp_service_zones').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
      ]);
      
      return {
        jobs: jobsResult.count || 0,
        customers: customersResult.count || 0,
        serviceZones: zonesResult.count || 0
      } as SyncCounts;
    },
    enabled: !!profile?.organization_id
  });

  // Get last sync timestamp from latest synced job
  const { data: lastSync } = useQuery({
    queryKey: ['hcp-last-sync', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data } = await supabase
        .from('hcp_jobs')
        .select('synced_at')
        .eq('organization_id', profile.organization_id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data?.synced_at;
    },
    enabled: !!profile?.organization_id
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-hcp-connection', {
        body: { 
          api_key: apiKey,
          company_id: companyId
        }
      });
      
      if (error) throw error;
      return data as HCPConnectionResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection successful",
          description: `Connected to: ${data.company_name}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.error || "Unable to connect to HouseCall Pro",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("No organization");
      
      const { error } = await supabase
        .from('organizations')
        .update({
          hcp_api_key: apiKey || null,
          hcp_company_id: companyId || null
        })
        .eq('id', profile.organization_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['organization-integration'] });
      toast({
        title: "Settings saved",
        description: "HouseCall Pro credentials have been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setHasChanges(value !== (organization?.hcp_api_key || "") || companyId !== (organization?.hcp_company_id || ""));
  };

  const handleCompanyIdChange = (value: string) => {
    setCompanyId(value);
    setHasChanges(apiKey !== (organization?.hcp_api_key || "") || value !== (organization?.hcp_company_id || ""));
  };

  const isConnected = !!(organization?.hcp_api_key);

  const formatLastSync = (timestamp: string | null | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  if (orgLoading) {
    return (
      <DashboardLayout title="Integration Settings" description="Manage external service connections">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Integration Settings" description="Manage external service connections">
      <div className="max-w-3xl">
        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-6">
            {/* HouseCall Pro Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      HouseCall Pro
                    </CardTitle>
                    <CardDescription>
                      Connect to HouseCall Pro to sync jobs, customers, and service zones
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={isConnected ? "default" : "secondary"}
                    className={isConnected ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Connected
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* API Credentials */}
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter your HouseCall Pro API key"
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Find your API key in HouseCall Pro under Settings → Integrations
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="company-id">Company ID (Optional)</Label>
                    <Input
                      id="company-id"
                      type="text"
                      placeholder="Enter your HouseCall Pro company ID"
                      value={companyId}
                      onChange={(e) => handleCompanyIdChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usually not required unless you have multiple companies
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => saveCredentialsMutation.mutate()}
                    disabled={!hasChanges || saveCredentialsMutation.isPending}
                  >
                    {saveCredentialsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={!apiKey || testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                </div>

                <Separator />

                {/* Sync Status */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Sync Status</h4>
                    <Button variant="outline" size="sm" disabled={!isConnected}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Last Sync</p>
                      <p className="text-sm font-medium truncate">
                        {formatLastSync(lastSync)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Jobs</p>
                      <p className="text-2xl font-semibold">{syncCounts?.jobs ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Customers</p>
                      <p className="text-2xl font-semibold">{syncCounts?.customers ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Service Zones</p>
                      <p className="text-2xl font-semibold">{syncCounts?.serviceZones ?? 0}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Automatic syncing will be available once Edge Functions are configured.
                    Use "Sync Now" to manually trigger a sync.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
