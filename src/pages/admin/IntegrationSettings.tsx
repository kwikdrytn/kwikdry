import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { SyncResult, SyncProgress } from "@/lib/housecallpro";
import { RCSyncResult, RCSyncProgress } from "@/lib/ringcentral";
import { EmployeeLinking } from "@/components/integrations/EmployeeLinking";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  Eye,
  EyeOff,
  Save,
  Zap,
  AlertCircle,
  MapPin,
  Phone
} from "lucide-react";

interface HCPConnectionResult {
  success: boolean;
  company_name?: string;
  error?: string;
}

interface SyncCounts {
  jobs: number;
  customers: number;
  employees: number;
  serviceZones: number;
}

interface RCConnectionResult {
  success: boolean;
  account_name?: string;
  account_id?: string;
  refresh_token?: string;
  error?: string;
}

interface ServiceZone {
  id: string;
  hcp_zone_id: string;
  name: string;
  color: string | null;
  polygon_geojson: object | null;
  synced_at: string | null;
}

// Default color palette for zones without custom colors
const DEFAULT_ZONE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export default function IntegrationSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // HouseCall Pro state
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle',
    message: '',
  });

  // RingCentral state
  const [isConnectingRc, setIsConnectingRc] = useState(false);
  const [rcSyncProgress, setRcSyncProgress] = useState<RCSyncProgress>({
    stage: 'idle',
    message: '',
  });

  // Fetch organization data (including RingCentral fields)
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization-integration', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, hcp_api_key, hcp_company_id, rc_client_id, rc_client_secret, rc_refresh_token, rc_account_id')
        .eq('id', profile.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Set initial values for HCP
      if (data) {
        setApiKey(data.hcp_api_key || "");
        setCompanyId(data.hcp_company_id || "");
      }
      
      return data;
    },
    enabled: !!profile?.organization_id
  });

  // Fetch sync counts
  const { data: syncCounts, refetch: refetchCounts } = useQuery({
    queryKey: ['hcp-sync-counts', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const [jobsResult, customersResult, employeesResult, zonesResult] = await Promise.all([
        supabase.from('hcp_jobs').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase.from('hcp_customers').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase.from('hcp_employees').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id),
        supabase.from('hcp_service_zones').select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id)
      ]);
      
      return {
        jobs: jobsResult.count || 0,
        customers: customersResult.count || 0,
        employees: employeesResult.count || 0,
        serviceZones: zonesResult.count || 0
      } as SyncCounts;
    },
    enabled: !!profile?.organization_id
  });

  // Fetch service zones
  const { data: serviceZones, refetch: refetchZones } = useQuery({
    queryKey: ['hcp-service-zones', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('hcp_service_zones')
        .select('id, hcp_zone_id, name, color, polygon_geojson, synced_at')
        .eq('organization_id', profile.organization_id)
        .order('name');
      
      if (error) throw error;
      return (data || []) as ServiceZone[];
    },
    enabled: !!profile?.organization_id
  });

  // Get last sync timestamp from latest synced job
  const { data: lastSync, refetch: refetchLastSync } = useQuery({
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

  // Sync data mutation
  const syncDataMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("No organization");
      if (!organization?.hcp_api_key) throw new Error("No API key configured");

      setSyncProgress({
        stage: 'syncing',
        message: 'Starting sync...',
        details: 'Connecting to HouseCall Pro',
      });

      const { data, error } = await supabase.functions.invoke('sync-hcp-data', {
        body: {
          organization_id: profile.organization_id,
          api_key: organization.hcp_api_key,
          location_id: profile.location_id,
        }
      });

      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSyncProgress({
          stage: 'complete',
          message: 'Sync complete!',
          details: `Synced ${data.synced?.jobs || 0} jobs, ${data.synced?.customers || 0} customers, ${data.synced?.employees || 0} employees, ${data.synced?.serviceZones || 0} zones`,
        });
        
        // Refresh counts, zones, and employees
        refetchCounts();
        refetchLastSync();
        refetchZones();
        queryClient.invalidateQueries({ queryKey: ['hcp-employees-with-links'] });
        
        toast({
          title: "Sync complete",
          description: `Successfully synced ${data.synced?.jobs || 0} jobs and ${data.synced?.customers || 0} customers`,
        });
      } else {
        setSyncProgress({
          stage: 'error',
          message: 'Sync failed',
          details: data.error || 'Unknown error',
        });
        
        toast({
          title: "Sync failed",
          description: data.error || "Unable to sync data from HouseCall Pro",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setSyncProgress({
        stage: 'error',
        message: 'Sync failed',
        details: error.message,
      });
      
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update zone color mutation
  const updateZoneColorMutation = useMutation({
    mutationFn: async ({ zoneId, color }: { zoneId: string; color: string }) => {
      const { error } = await supabase
        .from('hcp_service_zones')
        .update({ color })
        .eq('id', zoneId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchZones();
      toast({
        title: "Zone color updated",
        description: "The zone color has been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update color",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // RingCentral OAuth constants
  const RC_CLIENT_ID = 'd54LY9v6MLKawusT9IfF98';
  const RC_AUTH_URL = 'https://platform.ringcentral.com/restapi/oauth/authorize';
  const RC_REDIRECT_URI = 'https://kwikdry.lovable.app';

  // Handle OAuth callback via postMessage from popup
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Verify origin - accept from both preview and published domains
      if (!event.origin.includes('lovable.app') && !event.origin.includes('lovableproject.com')) {
        return;
      }
      
      if (event.data?.type === 'rc_oauth_callback' && event.data?.code) {
        setIsConnectingRc(true);
        
        try {
          const { data, error } = await supabase.functions.invoke('rc-oauth-callback', {
            body: {
              code: event.data.code,
              organization_id: profile?.organization_id,
            }
          });
          
          if (error) throw error;
          
          if (data.success) {
            toast({
              title: "RingCentral Connected",
              description: `Successfully connected to ${data.account_name}`,
            });
            queryClient.invalidateQueries({ queryKey: ['organization-integration'] });
          } else {
            toast({
              title: "Connection failed",
              description: data.error || "Unable to connect to RingCentral",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error('OAuth callback error:', err);
          toast({
            title: "Connection failed",
            description: err instanceof Error ? err.message : "An error occurred",
            variant: "destructive",
          });
        } finally {
          setIsConnectingRc(false);
        }
      }
    };
    
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [profile?.organization_id, queryClient]);

  // Start OAuth flow in popup window
  const handleConnectRingCentral = () => {
    const authUrl = new URL(RC_AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', RC_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', RC_REDIRECT_URI);
    authUrl.searchParams.set('state', 'rc_oauth');
    
    // Open in a popup window instead of redirecting (avoids iframe issues)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      authUrl.toString(),
      'ringcentral_oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  };

  // Disconnect RingCentral
  const disconnectRcMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("No organization");
      
      const { error } = await supabase
        .from('organizations')
        .update({
          rc_refresh_token: null,
          rc_account_id: null,
        })
        .eq('id', profile.organization_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-integration'] });
      toast({
        title: "Disconnected",
        description: "RingCentral has been disconnected",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to disconnect",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Sync RingCentral calls mutation
  const syncRcCallsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("No organization");
      if (!organization?.rc_refresh_token) throw new Error("RingCentral not connected");
      if (!profile?.location_id) throw new Error("No location selected");

      setRcSyncProgress({
        stage: 'syncing',
        message: 'Starting call sync...',
        details: 'Connecting to RingCentral',
      });

      const { data, error } = await supabase.functions.invoke('sync-rc-calls', {
        body: {
          organization_id: profile.organization_id,
          location_id: profile.location_id,
          client_id: organization.rc_client_id,
          client_secret: organization.rc_client_secret,
          refresh_token: organization.rc_refresh_token,
          hours_back: 24,
        }
      });

      if (error) throw error;
      return data as RCSyncResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        setRcSyncProgress({
          stage: 'complete',
          message: 'Sync complete!',
          details: `Synced ${data.synced?.calls || 0} calls (${data.synced?.matched || 0} matched, ${data.synced?.linked || 0} linked to jobs)`,
        });
        
        // Refresh counts
        queryClient.invalidateQueries({ queryKey: ['rc-call-count'] });
        queryClient.invalidateQueries({ queryKey: ['rc-last-sync'] });
        
        toast({
          title: "Call sync complete",
          description: `Synced ${data.synced?.calls || 0} calls from RingCentral`,
        });
      } else {
        setRcSyncProgress({
          stage: 'error',
          message: 'Sync failed',
          details: data.error || 'Unknown error',
        });
        
        toast({
          title: "Sync failed",
          description: data.error || "Unable to sync calls from RingCentral",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setRcSyncProgress({
        stage: 'error',
        message: 'Sync failed',
        details: error.message,
      });
      
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch call log counts for RingCentral
  const { data: callLogCount } = useQuery({
    queryKey: ['rc-call-count', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      
      const { count } = await supabase
        .from('call_log')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id);
      
      return count || 0;
    },
    enabled: !!profile?.organization_id
  });

  // Fetch last call sync timestamp
  const { data: lastCallSync, refetch: refetchLastCallSync } = useQuery({
    queryKey: ['rc-last-sync', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data } = await supabase
        .from('call_log')
        .select('synced_at')
        .eq('organization_id', profile.organization_id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data?.synced_at;
    },
    enabled: !!profile?.organization_id
  });

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setHasChanges(value !== (organization?.hcp_api_key || "") || companyId !== (organization?.hcp_company_id || ""));
  };

  const handleCompanyIdChange = (value: string) => {
    setCompanyId(value);
    setHasChanges(apiKey !== (organization?.hcp_api_key || "") || value !== (organization?.hcp_company_id || ""));
  };

  const handleZoneColorChange = (zoneId: string, color: string) => {
    updateZoneColorMutation.mutate({ zoneId, color });
  };

  const getZoneColor = (zone: ServiceZone, index: number): string => {
    return zone.color || DEFAULT_ZONE_COLORS[index % DEFAULT_ZONE_COLORS.length];
  };

  const isConnected = !!(organization?.hcp_api_key);
  const isSyncing = syncDataMutation.isPending;
  const isRcConnected = !!(organization?.rc_refresh_token);

  const formatLastSync = (timestamp: string | null | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const getSyncProgressColor = () => {
    switch (syncProgress.stage) {
      case 'syncing': return 'text-primary';
      case 'complete': return 'text-green-600';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!isConnected || isSyncing}
                      onClick={() => syncDataMutation.mutate()}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>

                  {/* Sync Progress */}
                  {syncProgress.stage !== 'idle' && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {syncProgress.stage === 'syncing' && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {syncProgress.stage === 'complete' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {syncProgress.stage === 'error' && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={`font-medium ${getSyncProgressColor()}`}>
                          {syncProgress.message}
                        </span>
                      </div>
                      {syncProgress.details && (
                        <p className="text-sm text-muted-foreground">
                          {syncProgress.details}
                        </p>
                      )}
                      {syncProgress.stage === 'syncing' && (
                        <Progress value={undefined} className="h-2" />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                      <p className="text-xs text-muted-foreground">Employees</p>
                      <p className="text-2xl font-semibold">{syncCounts?.employees ?? 0}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Service Zones</p>
                      <p className="text-2xl font-semibold">{syncCounts?.serviceZones ?? 0}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Syncs jobs scheduled for the next 30 days along with customers, employees, and service zones.
                  </p>
                </div>

                <Separator />

                {/* Service Zones */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Service Zones
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Customize zone colors for map display
                      </p>
                    </div>
                  </div>

                  {serviceZones && serviceZones.length > 0 ? (
                    <ScrollArea className="h-[200px] rounded-lg border">
                      <div className="p-4 space-y-3">
                        {serviceZones.map((zone, index) => (
                          <div 
                            key={zone.id} 
                            className="flex items-center justify-between gap-4 py-2 px-3 rounded-md hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="w-4 h-4 rounded-full border shrink-0"
                                style={{ backgroundColor: getZoneColor(zone, index) }}
                              />
                              <span className="font-medium truncate">{zone.name}</span>
                              {zone.polygon_geojson && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Has boundary
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Label htmlFor={`color-${zone.id}`} className="sr-only">
                                Zone color
                              </Label>
                              <input
                                id={`color-${zone.id}`}
                                type="color"
                                value={getZoneColor(zone, index)}
                                onChange={(e) => handleZoneColorChange(zone.id, e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                title="Click to change zone color"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-lg border p-6 text-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No service zones synced yet</p>
                      <p className="text-xs mt-1">
                        Click "Sync Now" to fetch zones from HouseCall Pro
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Employee Linking */}
                <EmployeeLinking />
              </CardContent>
            </Card>

            {/* RingCentral Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      RingCentral
                    </CardTitle>
                    <CardDescription>
                      Connect to RingCentral to sync call logs and recordings
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={isRcConnected ? "default" : "secondary"}
                    className={isRcConnected ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {isRcConnected ? (
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
                {/* OAuth Connection */}
                {isRcConnected ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-600">Connected to RingCentral</p>
                          {organization?.rc_account_id && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Account ID: <span className="font-mono">{organization.rc_account_id}</span>
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectRcMutation.mutate()}
                          disabled={disconnectRcMutation.isPending}
                        >
                          {disconnectRcMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Disconnect"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-6 text-center">
                      <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h4 className="font-medium mb-2">Connect RingCentral</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect your RingCentral account to sync call logs and recordings
                      </p>
                      <Button 
                        onClick={handleConnectRingCentral}
                        disabled={isConnectingRc}
                      >
                        {isConnectingRc ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        {isConnectingRc ? "Connecting..." : "Connect with RingCentral"}
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Sync Status */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Sync Status</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!isRcConnected || syncRcCallsMutation.isPending}
                      onClick={() => syncRcCallsMutation.mutate()}
                    >
                      {syncRcCallsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {syncRcCallsMutation.isPending ? 'Syncing...' : 'Sync Calls'}
                    </Button>
                  </div>

                  {/* Sync Progress */}
                  {rcSyncProgress.stage !== 'idle' && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {rcSyncProgress.stage === 'syncing' && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {rcSyncProgress.stage === 'complete' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {rcSyncProgress.stage === 'error' && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={`font-medium ${
                          rcSyncProgress.stage === 'syncing' ? 'text-primary' :
                          rcSyncProgress.stage === 'complete' ? 'text-green-600' :
                          rcSyncProgress.stage === 'error' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`}>
                          {rcSyncProgress.message}
                        </span>
                      </div>
                      {rcSyncProgress.details && (
                        <p className="text-sm text-muted-foreground">
                          {rcSyncProgress.details}
                        </p>
                      )}
                      {rcSyncProgress.stage === 'syncing' && (
                        <Progress value={undefined} className="h-2" />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Last Sync</p>
                      <p className="text-sm font-medium truncate">
                        {formatLastSync(lastCallSync)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Calls Synced</p>
                      <p className="text-2xl font-semibold">{callLogCount ?? 0}</p>
                    </div>
                    {isRcConnected && organization?.rc_account_id && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Account ID</p>
                        <p className="text-sm font-medium font-mono truncate">{organization.rc_account_id}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Syncs calls from the last 24 hours. Customer matching uses phone number lookups against HouseCall Pro customers.
                  </p>

                  {!isRcConnected && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-600">Setup Required</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter your RingCentral credentials and test the connection to enable call synchronization.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
