import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Check, Loader2, RefreshCw, Save, Link2, DollarSign } from "lucide-react";
import { SERVICE_TYPES, type PriceBookMapping } from "@/types/scheduling";

const DURATION_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2.5 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
];

interface HCPService {
  id: string;
  name: string;
  price?: number;
}

interface MappingRow {
  serviceType: string;
  itemId: string;
  itemName: string;
  duration: number;
  isDirty: boolean;
}

export default function PriceBookMappingPage() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [hcpServices, setHcpServices] = useState<HCPService[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch existing mappings
  const { data: existingMappings, isLoading } = useQuery({
    queryKey: ["pricebook-mapping", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("pricebook_mapping")
        .select("*")
        .eq("organization_id", profile.organization_id);

      if (error) throw error;
      return data as PriceBookMapping[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch HCP services from hcp_services table (synced from HCP Price Book API)
  // Same pattern as useServiceTypes in useJobMap.ts
  const { data: localServices, isLoading: isLoadingServices } = useQuery({
    queryKey: ["hcp-pricebook-services", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Primary source: hcp_services table (synced from HCP Price Book API)
      const { data, error } = await supabase
        .from("hcp_services")
        .select("hcp_service_id, name, price")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      return (data || []).map((s) => ({
        id: s.hcp_service_id,
        name: s.name,
        price: s.price ?? undefined,
      }));
    },
    enabled: !!profile?.organization_id,
  });

  // Initialize mappings when data loads
  useEffect(() => {
    const initialMappings: MappingRow[] = SERVICE_TYPES.map((serviceType) => {
      const existing = existingMappings?.find((m) => m.service_type === serviceType);
      return {
        serviceType,
        itemId: existing?.hcp_pricebook_item_id || "",
        itemName: existing?.hcp_pricebook_item_name || "",
        duration: existing?.default_duration_minutes || 60,
        isDirty: false,
      };
    });
    setMappings(initialMappings);
  }, [existingMappings]);

  useEffect(() => {
    if (localServices) {
      setHcpServices(localServices);
    }
  }, [localServices]);

  // Sync HCP PriceBook
  const handleSyncHCP = async () => {
    if (!profile?.organization_id) return;
    
    setIsSyncing(true);
    try {
      // Get HCP API key from organization
      const { data: org } = await supabase
        .from("organizations")
        .select("hcp_api_key")
        .eq("id", profile.organization_id)
        .single();

      if (!org?.hcp_api_key) {
        toast.error("HouseCall Pro not configured", {
          description: "Please configure your HCP API key in Integration Settings first.",
        });
        return;
      }

      const { error } = await supabase.functions.invoke("sync-hcp-data", {
        body: {
          organization_id: profile.organization_id,
          api_key: org.hcp_api_key,
        },
      });

      if (error) throw error;

      // Refetch the local services
      await queryClient.invalidateQueries({ queryKey: ["hcp-services"] });
      toast.success("HCP PriceBook synced successfully");
    } catch (error) {
      toast.error("Failed to sync HCP data", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (mapping: MappingRow) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { error } = await supabase
        .from("pricebook_mapping")
        .upsert(
          {
            organization_id: profile.organization_id,
            service_type: mapping.serviceType,
            hcp_pricebook_item_id: mapping.itemId,
            hcp_pricebook_item_name: mapping.itemName || null,
            default_duration_minutes: mapping.duration,
          },
          { onConflict: "organization_id,service_type" }
        );

      if (error) throw error;
    },
    onSuccess: (_, mapping) => {
      setMappings((prev) =>
        prev.map((m) => (m.serviceType === mapping.serviceType ? { ...m, isDirty: false } : m))
      );
      queryClient.invalidateQueries({ queryKey: ["pricebook-mapping"] });
      toast.success(`Saved mapping for ${mapping.serviceType}`);
    },
    onError: (error) => {
      toast.error("Failed to save mapping", { description: error.message });
    },
  });

  const updateMapping = (serviceType: string, updates: Partial<MappingRow>) => {
    setMappings((prev) =>
      prev.map((m) => (m.serviceType === serviceType ? { ...m, ...updates, isDirty: true } : m))
    );
  };

  const handleServiceSelect = (serviceType: string, hcpServiceId: string) => {
    const service = hcpServices.find((s) => s.id === hcpServiceId);
    updateMapping(serviceType, {
      itemId: hcpServiceId,
      itemName: service?.name || "",
    });
  };

  const handleSave = (mapping: MappingRow) => {
    if (!mapping.itemId) {
      toast.error("Please select a PriceBook item");
      return;
    }
    saveMutation.mutate(mapping);
  };

  const handleSaveAll = async () => {
    const dirtyMappings = mappings.filter((m) => m.isDirty && m.itemId);
    if (dirtyMappings.length === 0) {
      toast.info("No changes to save");
      return;
    }

    for (const mapping of dirtyMappings) {
      await saveMutation.mutateAsync(mapping);
    }
    toast.success(`Saved ${dirtyMappings.length} mappings`);
  };

  const unmappedCount = mappings.filter((m) => !m.itemId).length;
  const dirtyCount = mappings.filter((m) => m.isDirty).length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">PriceBook Mapping</h1>
            <p className="text-muted-foreground">
              Map your services to HouseCall Pro PriceBook items for accurate job creation with pricing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSyncHCP} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync HCP PriceBook
            </Button>
            {dirtyCount > 0 && (
              <Button onClick={handleSaveAll} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save All ({dirtyCount})
              </Button>
            )}
          </div>
        </div>

        {unmappedCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <span>
              <strong>{unmappedCount}</strong> service{unmappedCount > 1 ? "s" : ""} without PriceBook mapping will be created as custom line items without pricing.
            </span>
          </div>
        )}

        {hcpServices.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted border rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>
              No HCP PriceBook items found. Click <strong>"Sync HCP PriceBook"</strong> above to load your services and prices from HouseCall Pro.
            </span>
          </div>
        )}

        {hcpServices.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-sm">
            <DollarSign className="h-4 w-4 text-success flex-shrink-0" />
            <span>
              <strong>{hcpServices.length}</strong> PriceBook items loaded from HouseCall Pro. Select an item for each service type below.
            </span>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Service Mappings</CardTitle>
            <CardDescription>
              Select the HouseCall Pro PriceBook item for each service type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Service Type</TableHead>
                  <TableHead>HCP PriceBook Item</TableHead>
                  <TableHead className="w-[140px]">Default Duration</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.serviceType}>
                    <TableCell className="font-medium">{mapping.serviceType}</TableCell>
                    <TableCell>
                      {hcpServices.length > 0 ? (
                        <Select
                          value={mapping.itemId}
                          onValueChange={(value) => handleServiceSelect(mapping.serviceType, value)}
                        >
                          <SelectTrigger className="w-full max-w-[300px]">
                            <SelectValue placeholder="Select PriceBook item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {hcpServices.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                <div className="flex items-center gap-2">
                                  <span>{service.name}</span>
                                  {service.price && (
                                    <span className="text-muted-foreground">
                                      (${service.price.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter PriceBook Item ID..."
                            value={mapping.itemId}
                            onChange={(e) =>
                              updateMapping(mapping.serviceType, { itemId: e.target.value })
                            }
                            className="max-w-[300px]"
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={String(mapping.duration)}
                        onValueChange={(value) =>
                          updateMapping(mapping.serviceType, { duration: Number(value) })
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {mapping.itemId ? (
                        <Badge variant="outline" className="text-success border-success/30">
                          <Link2 className="h-3 w-3 mr-1" />
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not mapped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {mapping.isDirty && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(mapping)}
                          disabled={saveMutation.isPending || !mapping.itemId}
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              When AI suggestions create jobs in HouseCall Pro, the system uses these mappings to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Populate line items with correct pricing</strong> from your PriceBook
              </li>
              <li>
                <strong>Set accurate job durations</strong> based on the service type
              </li>
              <li>
                <strong>Ensure consistent invoicing</strong> across all AI-created jobs
              </li>
            </ul>
            <p className="pt-2">
              Services without mappings will be created as custom line items without pricing. You can
              still manually add pricing in HouseCall Pro after the job is created.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
