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
  CheckCircle2, 
  ClipboardCheck, 
  Package, 
  Wrench, 
  AlertTriangle,
  ChevronRight,
  GraduationCap 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useTrainingStatus } from "@/hooks/useIncompleteTrainingCount";

export function TechnicianDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "User";
  const today = new Date();
  
  // Fetch training status
  const { data: trainingStatus, isLoading: trainingLoading } = useTrainingStatus();
  
  // Fetch daily checklist status
  const { data: dailyStatus, isLoading: dailyLoading } = useQuery({
    queryKey: ['technician-daily-checklist', profile?.id, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('checklist_submissions')
        .select(`
          id,
          submitted_at,
          status,
          checklist_templates!inner(frequency)
        `)
        .eq('technician_id', profile.id)
        .eq('period_date', format(today, 'yyyy-MM-dd'))
        .eq('checklist_templates.frequency', 'daily')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch weekly checklist status (check for current week)
  const { data: weeklyStatus, isLoading: weeklyLoading } = useQuery({
    queryKey: ['technician-weekly-checklist', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      // Get start of current week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      
      const { data, error } = await supabase
        .from('checklist_submissions')
        .select(`
          id,
          submitted_at,
          status,
          period_date,
          checklist_templates!inner(frequency)
        `)
        .eq('technician_id', profile.id)
        .eq('checklist_templates.frequency', 'weekly')
        .gte('period_date', format(startOfWeek, 'yyyy-MM-dd'))
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch technician's inventory
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['technician-inventory', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { total: 0, lowStock: [] };
      
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          id,
          quantity,
          inventory_items!inner(id, name, reorder_threshold, unit)
        `)
        .eq('technician_id', profile.id)
        .is('deleted_at', null);
      
      if (error) throw error;
      
      const lowStock = data?.filter((s: any) => 
        Number(s.quantity) <= Number(s.inventory_items.reorder_threshold)
      ) || [];
      
      return { 
        total: data?.length || 0, 
        lowStock: lowStock.map((s: any) => ({
          name: s.inventory_items.name,
          quantity: s.quantity,
          threshold: s.inventory_items.reorder_threshold,
        }))
      };
    },
    enabled: !!profile?.id,
  });

  // Fetch technician's equipment
  const { data: equipmentData, isLoading: equipmentLoading } = useQuery({
    queryKey: ['technician-equipment', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, type, status')
        .eq('assigned_to', profile.id)
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      maintenance: 'destructive',
      retired: 'secondary',
    };
    return variants[status] || 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Checklist Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Checklist Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Today's Checklist
            </CardTitle>
            <CardDescription>Daily vehicle & equipment check</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : dailyStatus ? (
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-primary">Completed</p>
                  <p className="text-sm text-muted-foreground">
                    at {format(new Date(dailyStatus.submitted_at!), "h:mm a")}
                  </p>
                </div>
              </div>
            ) : (
              <Button 
                size="lg" 
                className="w-full h-16 text-lg"
                onClick={() => navigate('/checklists?type=daily')}
              >
                Complete Daily Checklist
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Weekly Checklist Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Weekly Checklist
            </CardTitle>
            <CardDescription>Weekly maintenance & safety check</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : weeklyStatus ? (
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-primary">Completed</p>
                  <p className="text-sm text-muted-foreground">
                    on {format(new Date(weeklyStatus.submitted_at!), "EEEE")}
                  </p>
                </div>
              </div>
            ) : (
              <Button 
                size="lg" 
                className="w-full h-16 text-lg"
                onClick={() => navigate('/checklists?type=weekly')}
              >
                Complete Weekly Checklist
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Training Status Card */}
      <Card className={cn(
        trainingStatus && trainingStatus.incompleteCount > 0 
          ? "border-warning/50" 
          : "border-primary/30"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className={cn(
              "h-5 w-5",
              trainingStatus && trainingStatus.incompleteCount > 0 
                ? "text-warning" 
                : "text-primary"
            )} />
            Training Status
          </CardTitle>
          <CardDescription>Required training progress</CardDescription>
        </CardHeader>
        <CardContent>
          {trainingLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : trainingStatus && trainingStatus.incompleteCount > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-warning/10 p-4">
                <AlertTriangle className="h-8 w-8 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-warning">
                    {trainingStatus.incompleteCount} required training video{trainingStatus.incompleteCount !== 1 ? 's' : ''} to complete
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={trainingStatus.progressPercent} className="h-2 flex-1" />
                    <span className="text-sm text-muted-foreground">
                      {trainingStatus.progressPercent}%
                    </span>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full h-12"
                onClick={() => navigate('/training')}
              >
                Go to Training
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-primary">All required training complete! ✓</p>
                  <p className="text-sm text-muted-foreground">
                    Great job staying up to date
                  </p>
                </div>
              </div>
              <Button 
                variant="outline"
                className="w-full h-12"
                onClick={() => navigate('/training')}
              >
                Browse more videos
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory & Equipment Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* My Inventory Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              My Inventory
            </CardTitle>
            <CardDescription>Items assigned to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{inventoryData?.total || 0}</span>
                  <span className="text-muted-foreground">items</span>
                </div>
                
                {inventoryData?.lowStock && inventoryData.lowStock.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Low Stock Warning
                    </div>
                    <ul className="space-y-1 text-sm">
                      {inventoryData.lowStock.slice(0, 3).map((item: any, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          {item.name}: {item.quantity} left
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => navigate('/admin/inventory')}
                >
                  View My Inventory
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* My Equipment Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-primary" />
              My Equipment
            </CardTitle>
            <CardDescription>Equipment assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            {equipmentLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : equipmentData && equipmentData.length > 0 ? (
              <ul className="space-y-3">
                {equipmentData.slice(0, 5).map((equip: any) => (
                  <li 
                    key={equip.id} 
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{equip.name}</p>
                      <p className="text-sm text-muted-foreground">{equip.type}</p>
                    </div>
                    <Badge 
                      variant={statusBadge(equip.status)}
                      className={cn(
                        equip.status === 'active' && "bg-primary/10 text-primary",
                        equip.status === 'maintenance' && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {equip.status === 'maintenance' ? 'Needs Service' : equip.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No equipment assigned
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
