import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useInventoryItems } from "@/hooks/useInventory";
import { useRecordUsage } from "@/hooks/useRecordUsage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Minus,
  Package,
  AlertTriangle,
  Droplets,
  Box,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
  cleaning_solution: <Droplets className="h-5 w-5" />,
  supply: <Box className="h-5 w-5" />,
  consumable: <ShoppingBag className="h-5 w-5" />,
};

const categoryLabels: Record<string, string> = {
  cleaning_solution: "Cleaning",
  supply: "Supply",
  consumable: "Consumable",
};

const unitLabels: Record<string, string> = {
  gallon: "gal",
  oz: "oz",
  liter: "L",
  ml: "ml",
  each: "ea",
  box: "box",
  case: "case",
  roll: "roll",
  bag: "bag",
};

export function TechnicianInventoryView() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const recordUsage = useRecordUsage();

  // Fetch technician's personal stock with item details
  const { data: myStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["technician-full-inventory", profile?.id, profile?.location_id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Get tech's personal stock
      const { data: techStock, error: techErr } = await supabase
        .from("inventory_stock")
        .select(
          `
          id,
          quantity,
          item_id,
          technician_id,
          inventory_items!inner(id, name, category, unit, reorder_threshold, expiration_date, notes)
        `
        )
        .eq("technician_id", profile.id)
        .is("deleted_at", null);

      if (techErr) throw techErr;

      // Also get location-level stock if tech has a location
      let locationStock: any[] = [];
      if (profile.location_id) {
        const { data: locStock, error: locErr } = await supabase
          .from("inventory_stock")
          .select(
            `
            id,
            quantity,
            item_id,
            technician_id,
            inventory_items!inner(id, name, category, unit, reorder_threshold, expiration_date, notes)
          `
          )
          .eq("location_id", profile.location_id)
          .is("technician_id", null)
          .is("deleted_at", null);

        if (!locErr) locationStock = locStock || [];
      }

      // Merge: tech stock takes priority, add location stock for items tech doesn't have
      const techItemIds = new Set(techStock?.map((s: any) => s.item_id) || []);
      const allStock = [
        ...(techStock || []).map((s: any) => ({
          ...s,
          source: "mine" as const,
        })),
        ...locationStock
          .filter((s: any) => !techItemIds.has(s.item_id))
          .map((s: any) => ({ ...s, source: "location" as const })),
      ];

      return allStock.map((s: any) => ({
        id: s.inventory_items.id,
        stockId: s.id,
        name: s.inventory_items.name,
        category: s.inventory_items.category,
        unit: s.inventory_items.unit,
        quantity: Number(s.quantity),
        reorderThreshold: Number(s.inventory_items.reorder_threshold),
        expirationDate: s.inventory_items.expiration_date,
        notes: s.inventory_items.notes,
        source: s.source,
      }));
    },
    enabled: !!profile?.id,
  });

  const filteredStock = useMemo(() => {
    if (!search) return myStock;
    const lower = search.toLowerCase();
    return myStock.filter((item) => item.name.toLowerCase().includes(lower));
  }, [myStock, search]);

  const lowStockItems = useMemo(
    () => myStock.filter((item) => item.quantity <= item.reorderThreshold),
    [myStock]
  );

  const totalItems = myStock.length;
  const totalLow = lowStockItems.length;

  const handleUse = (item: (typeof myStock)[0]) => {
    recordUsage.mutate({ itemId: item.id, itemName: item.name });
  };

  return (
    <DashboardLayout title="My Inventory">
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(totalLow > 0 && "border-destructive/50")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={cn(
                  "rounded-full p-2.5",
                  totalLow > 0
                    ? "bg-destructive/10"
                    : "bg-muted"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-5 w-5",
                    totalLow > 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLow}</p>
                <p className="text-xs text-muted-foreground">Low Stock</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert Banner */}
        {totalLow > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  Low Stock Alert
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowStockItems.slice(0, 5).map((item) => (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className="border-destructive/30 text-destructive text-xs"
                  >
                    {item.name}: {item.quantity} left
                  </Badge>
                ))}
                {totalLow > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{totalLow - 5} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>

        {/* Product List */}
        {stockLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredStock.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-medium text-muted-foreground">
                {search ? "No products match your search" : "No inventory assigned"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search
                  ? "Try a different search term"
                  : "Contact your admin to get products assigned"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredStock.map((item) => {
              const isLow = item.quantity <= item.reorderThreshold;
              const isEmpty = item.quantity <= 0;

              return (
                <Card
                  key={item.stockId}
                  className={cn(
                    "transition-colors",
                    isEmpty && "opacity-60",
                    isLow && !isEmpty && "border-destructive/30"
                  )}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        "rounded-lg p-2.5 shrink-0",
                        isLow
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {categoryIcons[item.category] || (
                        <Package className="h-5 w-5" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {categoryLabels[item.category] || item.category}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {item.quantity} {unitLabels[item.unit] || item.unit}
                        </span>
                        {item.source === "location" && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              ·
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Shop
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quantity + Use Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          isEmpty
                            ? "destructive"
                            : isLow
                            ? "secondary"
                            : "outline"
                        }
                        className={cn(
                          "tabular-nums text-sm min-w-[3rem] justify-center",
                          isLow &&
                            !isEmpty &&
                            "bg-warning/10 text-warning border-warning/30"
                        )}
                      >
                        {item.quantity}
                      </Badge>
                      <Button
                        size="icon"
                        variant={isEmpty ? "ghost" : "default"}
                        className="h-10 w-10 rounded-full shrink-0"
                        disabled={isEmpty || recordUsage.isPending}
                        onClick={() => handleUse(item)}
                        aria-label={`Use 1 ${item.name}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
