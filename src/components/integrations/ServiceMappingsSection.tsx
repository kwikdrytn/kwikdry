import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, Check, ChevronDown, Link2, Loader2, Save } from "lucide-react";
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

export function ServiceMappingsSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [hcpServices, setHcpServices] = useState<HCPService[]>([]);

  // Fetch existing mappings
  const { data: existingMappings } = useQuery({
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

  // Fetch HCP services from hcp_services table
  const { data: localServices } = useQuery({
    queryKey: ["hcp-pricebook-services", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

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

  const mappedCount = mappings.filter((m) => m.itemId).length;
  const dirtyCount = mappings.filter((m) => m.isDirty).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            <h4 className="font-medium">Service Mappings</h4>
            <Badge variant="outline" className="ml-1 text-xs">
              {mappedCount}/{SERVICE_TYPES.length}
            </Badge>
          </Button>
        </CollapsibleTrigger>
        {isOpen && dirtyCount > 0 && (
          <Button size="sm" onClick={handleSaveAll} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save All ({dirtyCount})
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Map your services to HouseCall Pro PriceBook items for accurate job creation with pricing.
          Services without mappings will be created as custom line items without pricing.
        </p>

        {hcpServices.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted border rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>
              No PriceBook items found. Click <strong>"Sync Now"</strong> above to load your services from HouseCall Pro.
            </span>
          </div>
        )}

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
                    <Input
                      placeholder="Enter PriceBook Item ID..."
                      value={mapping.itemId}
                      onChange={(e) =>
                        updateMapping(mapping.serviceType, { itemId: e.target.value })
                      }
                      className="max-w-[300px]"
                    />
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
      </CollapsibleContent>
    </Collapsible>
  );
}
