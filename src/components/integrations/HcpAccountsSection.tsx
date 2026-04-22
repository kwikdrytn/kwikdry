import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Zap,
  Eye,
  EyeOff,
} from "lucide-react";

const NO_LOCATION_VALUE = "__none__";

interface HcpAccount {
  id: string;
  organization_id: string;
  location_id: string | null;
  label: string;
  hcp_api_key: string | null;
  hcp_company_id: string | null;
  is_active: boolean;
  last_synced_at: string | null;
}

interface LocationOption {
  id: string;
  name: string;
}

interface AccountFormState {
  id?: string;
  label: string;
  location_id: string;
  hcp_api_key: string;
  hcp_company_id: string;
  is_active: boolean;
}

const emptyForm: AccountFormState = {
  label: "",
  location_id: NO_LOCATION_VALUE,
  hcp_api_key: "",
  hcp_company_id: "",
  is_active: true,
};

export function HcpAccountsSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["hcp-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hcp_accounts")
        .select("*")
        .eq("organization_id", orgId!)
        .order("label");
      if (error) throw error;
      return (data ?? []) as HcpAccount[];
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-for-hcp", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as LocationOption[];
    },
  });

  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? "All locations";

  const openAdd = () => {
    setForm(emptyForm);
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const openEdit = (acc: HcpAccount) => {
    setForm({
      id: acc.id,
      label: acc.label,
      location_id: acc.location_id ?? NO_LOCATION_VALUE,
      hcp_api_key: acc.hcp_api_key ?? "",
      hcp_company_id: acc.hcp_company_id ?? "",
      is_active: acc.is_active,
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No organization");
      const payload = {
        organization_id: orgId,
        label: form.label.trim(),
        location_id:
          form.location_id === NO_LOCATION_VALUE ? null : form.location_id,
        hcp_api_key: form.hcp_api_key || null,
        hcp_company_id: form.hcp_company_id || null,
        is_active: form.is_active,
      };
      if (!payload.label) throw new Error("Label is required");

      if (form.id) {
        const { error } = await supabase
          .from("hcp_accounts")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hcp_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-accounts", orgId] });
      setDialogOpen(false);
      toast({ title: "Saved", description: "HouseCall Pro account saved" });
    },
    onError: (err: Error) =>
      toast({
        title: "Failed to save",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hcp_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hcp-accounts", orgId] });
      setDeleteId(null);
      toast({ title: "Removed", description: "HouseCall Pro account removed" });
    },
    onError: (err: Error) =>
      toast({
        title: "Failed to remove",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleTest = async (acc: HcpAccount) => {
    if (!acc.hcp_api_key) {
      toast({
        title: "No API key",
        description: "Add an API key first",
        variant: "destructive",
      });
      return;
    }
    setTestingId(acc.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "test-hcp-connection",
        {
          body: {
            api_key: acc.hcp_api_key,
            company_id: acc.hcp_company_id,
          },
        },
      );
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Connection successful",
          description: `Connected to: ${data.company_name ?? "HouseCall Pro"}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: data?.error ?? "Unable to connect",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Connection test failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (acc: HcpAccount) => {
    if (!acc.hcp_api_key) {
      toast({
        title: "No API key",
        description: "Add an API key first",
        variant: "destructive",
      });
      return;
    }
    setSyncingId(acc.id);
    try {
      const { data, error } = await supabase.functions.invoke("sync-hcp-data", {
        body: { hcp_account_id: acc.id },
      });
      if (error) throw error;
      if (data?.success) {
        await supabase
          .from("hcp_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", acc.id);
        queryClient.invalidateQueries({ queryKey: ["hcp-accounts", orgId] });
        queryClient.invalidateQueries({ queryKey: ["hcp-sync-counts"] });
        queryClient.invalidateQueries({ queryKey: ["hcp-last-sync"] });
        toast({
          title: "Sync complete",
          description: `${data.synced?.jobs ?? 0} jobs, ${data.synced?.customers ?? 0} customers`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: data?.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Accounts</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Connect one HouseCall Pro account per location, or add a shared org-wide account.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No HouseCall Pro accounts connected yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const connected = !!acc.hcp_api_key && acc.is_active;
            return (
              <Card key={acc.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{acc.label}</span>
                      <Badge
                        variant={connected ? "default" : "secondary"}
                        className={connected ? "bg-green-600 hover:bg-green-600" : ""}
                      >
                        {connected ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            {acc.is_active ? "No key" : "Disabled"}
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locationName(acc.location_id)}
                      {acc.hcp_company_id ? ` · Company: ${acc.hcp_company_id}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last sync:{" "}
                      {acc.last_synced_at
                        ? new Date(acc.last_synced_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(acc)}
                      disabled={testingId === acc.id || !acc.hcp_api_key}
                    >
                      {testingId === acc.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(acc)}
                      disabled={syncingId === acc.id || !connected}
                    >
                      {syncingId === acc.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(acc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit HouseCall Pro account" : "Add HouseCall Pro account"}
            </DialogTitle>
            <DialogDescription>
              Each account is linked to one location, or to all locations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-label">Label</Label>
              <Input
                id="acc-label"
                placeholder="e.g. Main office"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acc-location">Location</Label>
              <Select
                value={form.location_id}
                onValueChange={(v) => setForm({ ...form, location_id: v })}
              >
                <SelectTrigger id="acc-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LOCATION_VALUE}>All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acc-key">API key</Label>
              <div className="relative">
                <Input
                  id="acc-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="HouseCall Pro API key"
                  value={form.hcp_api_key}
                  onChange={(e) =>
                    setForm({ ...form, hcp_api_key: e.target.value })
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey((v) => !v)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acc-company">Company ID (optional)</Label>
              <Input
                id="acc-company"
                placeholder="HouseCall Pro company ID"
                value={form.hcp_company_id}
                onChange={(e) =>
                  setForm({ ...form, hcp_company_id: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.label.trim()}
            >
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove HouseCall Pro account?</AlertDialogTitle>
            <AlertDialogDescription>
              Synced jobs and customers from this account will remain in the database
              but will no longer be associated with an active connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
