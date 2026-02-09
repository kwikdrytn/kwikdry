import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  ClipboardList, 
  Package, 
  PhoneMissed,
  Map,
  Boxes,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  ChevronRight,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEquipmentNeedingMaintenance } from "@/hooks/useEquipment";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "Admin";
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Get equipment needing maintenance
  const { data: equipmentNeedingMaintenance = [], isLoading: maintenanceLoading } = useEquipmentNeedingMaintenance();
  

  // Fetch today's jobs count (placeholder - will integrate HCP later)
  const { data: jobsCount, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-jobs-today', profile?.organization_id, todayStr],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      
      const { count, error } = await supabase
        .from('hcp_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('scheduled_date', todayStr);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch pending checklists (technicians who haven't submitted today)
  const { data: pendingChecklists, isLoading: checklistsLoading } = useQuery({
    queryKey: ['admin-pending-checklists', profile?.organization_id, todayStr],
    queryFn: async () => {
      if (!profile?.organization_id) return { count: 0, technicians: [] };
      
      // Get all active technicians
      const { data: technicians, error: techError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null);
      
      if (techError) throw techError;
      
      // Get today's submissions
      const { data: submissions, error: subError } = await supabase
        .from('checklist_submissions')
        .select('technician_id, checklist_templates!inner(frequency)')
        .eq('period_date', todayStr)
        .eq('checklist_templates.frequency', 'daily');
      
      if (subError) throw subError;
      
      const submittedIds = new Set(submissions?.map(s => s.technician_id) || []);
      const pending = technicians?.filter(t => !submittedIds.has(t.id)) || [];
      
      return { 
        count: pending.length, 
        technicians: pending.slice(0, 5) 
      };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch low stock items
  const { data: lowStockData, isLoading: stockLoading } = useQuery({
    queryKey: ['admin-low-stock', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return { count: 0, items: [] };
      
      // Get items with their total stock
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, reorder_threshold, unit')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      if (itemsError) throw itemsError;
      
      // Get stock totals
      const { data: stocks, error: stockError } = await supabase
        .from('inventory_stock')
        .select('item_id, quantity')
        .is('deleted_at', null);
      
      if (stockError) throw stockError;
      
      // Calculate totals per item
      const stockTotals: Record<string, number> = {};
      stocks?.forEach(s => {
        stockTotals[s.item_id] = (stockTotals[s.item_id] || 0) + Number(s.quantity);
      });
      
      // Find low stock items
      const lowStock = items?.filter(item => 
        (stockTotals[item.id] || 0) <= item.reorder_threshold
      ).map(item => ({
        ...item,
        currentStock: stockTotals[item.id] || 0
      })) || [];
      
      return { count: lowStock.length, items: lowStock.slice(0, 5) };
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch missed calls today
  const { data: missedCalls, isLoading: callsLoading } = useQuery({
    queryKey: ['admin-missed-calls', profile?.organization_id, todayStr],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      
      const { count, error } = await supabase
        .from('call_log')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'missed')
        .gte('started_at', `${todayStr}T00:00:00`)
        .lt('started_at', `${todayStr}T23:59:59`);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.organization_id,
  });

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">
          {getGreeting()}, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Today's Jobs</CardDescription>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{jobsCount}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Scheduled for today</p>
          </CardContent>
        </Card>

        {/* Pending Checklists */}
        <Card className={cn(
          pendingChecklists?.count && pendingChecklists.count > 0 && "border-warning/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className={cn(
              pendingChecklists?.count && pendingChecklists.count > 0 && "text-warning"
            )}>
              Pending Checklists
            </CardDescription>
            <ClipboardList className={cn(
              "h-4 w-4",
              pendingChecklists?.count && pendingChecklists.count > 0 
                ? "text-warning" 
                : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            {checklistsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={cn(
                "text-3xl font-bold",
                pendingChecklists?.count && pendingChecklists.count > 0 && "text-warning"
              )}>
                {pendingChecklists?.count || 0}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Technicians awaiting</p>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card className={cn(
          lowStockData?.count && lowStockData.count > 0 && "border-destructive/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className={cn(
              lowStockData?.count && lowStockData.count > 0 && "text-destructive"
            )}>
              Low Stock Items
            </CardDescription>
            <Package className={cn(
              "h-4 w-4",
              lowStockData?.count && lowStockData.count > 0 
                ? "text-destructive" 
                : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            {stockLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={cn(
                "text-3xl font-bold",
                lowStockData?.count && lowStockData.count > 0 && "text-destructive"
              )}>
                {lowStockData?.count || 0}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Need reordering</p>
          </CardContent>
        </Card>

        {/* Missed Calls Today */}
        <Card className={cn(
          missedCalls && missedCalls > 0 && "border-destructive/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className={cn(
              missedCalls && missedCalls > 0 && "text-destructive"
            )}>
              Missed Calls
            </CardDescription>
            <PhoneMissed className={cn(
              "h-4 w-4",
              missedCalls && missedCalls > 0 
                ? "text-destructive" 
                : "text-muted-foreground"
            )} />
          </CardHeader>
          <CardContent>
            {callsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={cn(
                "text-3xl font-bold",
                missedCalls && missedCalls > 0 && "text-destructive"
              )}>
                {missedCalls}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button 
              variant="outline" 
              className="h-14 justify-start gap-3"
              onClick={() => navigate('/job-map')}
            >
              <Map className="h-5 w-5 text-primary" />
              <span>View Job Map</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-14 justify-start gap-3"
              onClick={() => navigate('/inventory')}
            >
              <Boxes className="h-5 w-5 text-primary" />
              <span>Manage Inventory</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-14 justify-start gap-3"
              onClick={() => navigate('/checklists')}
            >
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span>Review Checklists</span>
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Alerts & Activity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alerts
            </CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Low Stock Alerts */}
            {lowStockData?.items && lowStockData.items.length > 0 ? (
              lowStockData.items.map((item: any) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.currentStock} / {item.reorder_threshold} {item.unit}
                      </p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                </div>
              ))
            ) : null}

            {/* Pending Checklist Alerts */}
            {pendingChecklists?.technicians && pendingChecklists.technicians.length > 0 ? (
              pendingChecklists.technicians.map((tech: any) => (
                <div 
                  key={tech.id}
                  className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-warning" />
                    <div>
                      <p className="font-medium text-sm">
                        {[tech.first_name, tech.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Daily checklist not submitted
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-warning/10 text-warning border-warning/30 text-xs">
                    Pending
                  </Badge>
                </div>
              ))
            ) : null}

            {/* Equipment Needing Maintenance Alerts */}
            {equipmentNeedingMaintenance.length > 0 ? (
              equipmentNeedingMaintenance.slice(0, 5).map((equip: any) => (
                <div 
                  key={equip.id}
                  onClick={() => navigate(`/equipment/${equip.id}`)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50",
                    equip.is_overdue 
                      ? "border-destructive/30 bg-destructive/5" 
                      : "border-warning/30 bg-warning/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Wrench className={cn(
                      "h-4 w-4",
                      equip.is_overdue ? "text-destructive" : "text-warning"
                    )} />
                    <div>
                      <p className="font-medium text-sm">{equip.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {equip.is_overdue 
                          ? `Overdue by ${Math.abs(equip.days_until_due)} day${Math.abs(equip.days_until_due) !== 1 ? 's' : ''}`
                          : `Due in ${equip.days_until_due} day${equip.days_until_due !== 1 ? 's' : ''}`
                        }
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={equip.is_overdue ? "destructive" : "secondary"}
                    className={cn(
                      "text-xs",
                      !equip.is_overdue && "bg-warning/10 text-warning border-warning/30"
                    )}
                  >
                    {equip.is_overdue ? 'Overdue' : 'Due Soon'}
                  </Badge>
                </div>
              ))
            ) : null}

            {/* No Alerts */}
            {(!lowStockData?.items?.length && !pendingChecklists?.technicians?.length && !equipmentNeedingMaintenance.length) && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-3">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <p className="text-muted-foreground">No alerts at this time</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest actions across the organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Activity feed coming soon</p>
              <p className="text-sm text-muted-foreground mt-1">
                Track inventory changes, checklist submissions, and more
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
