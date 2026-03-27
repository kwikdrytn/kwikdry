import { useState, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarIcon, DollarSign, Settings2, RefreshCw } from "lucide-react";
import { usePayrollReport, usePayConfigs, useUpsertPayConfig, useCcFeePercent, useUpdateCcFeePercent, TechnicianPayroll } from "@/hooks/usePayrollReport";
import { useUsers } from "@/hooks/useUsers";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default function PayrollReports() {
  const [mode, setMode] = useState<'weekly' | 'custom'>('weekly');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 });

  const startDate = mode === 'weekly' ? format(weekStart, 'yyyy-MM-dd') : (customStart ? format(customStart, 'yyyy-MM-dd') : '');
  const endDate = mode === 'weekly' ? format(weekEnd, 'yyyy-MM-dd') : (customEnd ? format(customEnd, 'yyyy-MM-dd') : '');

  const { data: payrollData, isLoading } = usePayrollReport(startDate, endDate);
  const { data: ccFeePercent } = useCcFeePercent();

  const totals = useMemo(() => {
    if (!payrollData) return { jobs: 0, revenue: 0, tips: 0, ccFees: 0, netPay: 0 };
    return payrollData.reduce((acc, t) => ({
      jobs: acc.jobs + t.jobCount,
      revenue: acc.revenue + t.grossRevenue,
      tips: acc.tips + t.totalTips,
      ccFees: acc.ccFees + t.ccFeesOnRevenue + t.ccFeesOnTips,
      netPay: acc.netPay + t.netPay,
    }), { jobs: 0, revenue: 0, tips: 0, ccFees: 0, netPay: 0 });
  }, [payrollData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payroll Reports</h1>
            <p className="text-muted-foreground text-sm">Revenue, tips, and CC fees by technician</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={syncing} onClick={async () => {
              setSyncing(true);
              try {
                const { error } = await supabase.functions.invoke('sync-hcp-data');
                if (error) throw error;
                toast.success('HCP data synced successfully');
              } catch (e: any) {
                toast.error('Sync failed: ' + (e.message || 'Unknown error'));
              } finally {
                setSyncing(false);
              }
            }}>
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              {syncing ? 'Syncing…' : 'Sync HCP'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Pay Settings
            </Button>
          </div>
        </div>

        {/* Date Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Period</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as 'weekly' | 'custom')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === 'weekly' ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWeekAnchor(d => subWeeks(d, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[200px] text-center font-medium text-sm">
                    {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setWeekAnchor(d => addWeeks(d, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStart ? format(customStart, 'MMM d, yyyy') : 'Start'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customStart} onSelect={setCustomStart} /></PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start text-left text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEnd ? format(customEnd, 'MMM d, yyyy') : 'End'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} /></PopoverContent>
                  </Popover>
                </div>
              )}

              <Badge variant="secondary" className="ml-auto text-xs">
                CC Fee: {ccFeePercent ?? 3}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technician Payroll Summary</CardTitle>
            <CardDescription>
              {startDate && endDate ? `${format(new Date(startDate + 'T12:00:00'), 'MMM d')} – ${format(new Date(endDate + 'T12:00:00'), 'MMM d, yyyy')}` : 'Select a date range'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !payrollData?.length ? (
              <p className="py-8 text-center text-muted-foreground">No completed jobs found for this period</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">Technician</TableHead>
                    <TableHead className="w-[8%] text-center">Jobs</TableHead>
                    <TableHead className="w-[14%] text-right">Revenue</TableHead>
                    <TableHead className="w-[12%] text-right">Tips</TableHead>
                    <TableHead className="w-[12%] text-right">CC Fees</TableHead>
                    <TableHead className="w-[14%] text-right">Net Pay</TableHead>
                    <TableHead className="w-[12%] text-center">Model</TableHead>
                    <TableHead className="w-[8%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.map(tech => (
                    <Collapsible key={tech.technician_hcp_id} open={expandedTech === tech.technician_hcp_id} onOpenChange={(open) => setExpandedTech(open ? tech.technician_hcp_id : null)}>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="w-[20%] font-medium">{tech.technician_name}</TableCell>
                          <TableCell className="w-[8%] text-center">{tech.jobCount}</TableCell>
                          <TableCell className="w-[14%] text-right">{formatCurrency(tech.grossRevenue)}</TableCell>
                          <TableCell className="w-[12%] text-right">{formatCurrency(tech.totalTips)}</TableCell>
                          <TableCell className="w-[12%] text-right text-destructive">-{formatCurrency(tech.ccFeesOnRevenue + tech.ccFeesOnTips)}</TableCell>
                          <TableCell className="w-[14%] text-right font-semibold">{formatCurrency(tech.netPay)}</TableCell>
                          <TableCell className="w-[12%] text-center">
                            <Badge variant="outline" className="text-xs capitalize">{tech.payModel}</Badge>
                          </TableCell>
                          <TableCell className="w-[8%]">
                            {expandedTech === tech.technician_hcp_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div className="bg-muted/30 px-6 py-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {tech.payModel === 'salary' && `Weekly Salary: ${formatCurrency(tech.weeklySalary)} + Tips - CC Fees on Tips`}
                                {tech.payModel === 'commission' && `${tech.commissionPercent}% Commission - CC Fees + Tips - CC Fees on Tips`}
                                {tech.payModel === 'none' && 'No pay model configured'}
                              </p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Date</TableHead>
                                    <TableHead className="text-xs">Customer</TableHead>
                                    <TableHead className="text-xs">Service</TableHead>
                                    <TableHead className="text-xs text-right">Amount</TableHead>
                                    <TableHead className="text-xs text-right">Tip</TableHead>
                                    <TableHead className="text-xs">Payment</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {tech.jobs.map(job => (
                                    <TableRow key={job.id} className="text-xs">
                                      <TableCell>{job.scheduled_date ? format(new Date(job.scheduled_date + 'T12:00:00'), 'MMM d') : '-'}</TableCell>
                                      <TableCell>{job.customer_name || '-'}</TableCell>
                                      <TableCell className="max-w-[150px] truncate">
                                        {Array.isArray(job.services) ? job.services.map((s: any) => s.name).filter(Boolean).join(', ') : '-'}
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(Number(job.total_amount) || 0)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(Number(job.tip_amount) || 0)}</TableCell>
                                      <TableCell>{job.payment_method || '-'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell className="w-[20%]">Totals</TableCell>
                    <TableCell className="w-[8%] text-center">{totals.jobs}</TableCell>
                    <TableCell className="w-[14%] text-right">{formatCurrency(totals.revenue)}</TableCell>
                    <TableCell className="w-[12%] text-right">{formatCurrency(totals.tips)}</TableCell>
                    <TableCell className="w-[12%] text-right text-destructive">-{formatCurrency(totals.ccFees)}</TableCell>
                    <TableCell className="w-[14%] text-right">{formatCurrency(totals.netPay)}</TableCell>
                    <TableCell className="w-[20%]" colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <PaySettingsDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
    </DashboardLayout>
  );
}

function PaySettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: users } = useUsers();
  const { data: configs } = usePayConfigs();
  const { data: ccFee } = useCcFeePercent();
  const upsertPay = useUpsertPayConfig();
  const updateCcFee = useUpdateCcFeePercent();

  const [selectedProfile, setSelectedProfile] = useState('');
  const [payModel, setPayModel] = useState<'salary' | 'commission'>('salary');
  const [salary, setSalary] = useState('1000');
  const [commission, setCommission] = useState('40');
  const [localCcFee, setLocalCcFee] = useState(String(ccFee ?? 3));

  const technicians = users?.filter(u => u.role === 'technician' && u.is_active) || [];

  // When a tech is selected, load their current config
  const handleSelectTech = (profileId: string) => {
    setSelectedProfile(profileId);
    const existing = (configs as any[])?.find((c: any) => c.profile_id === profileId);
    if (existing) {
      setPayModel(existing.pay_model);
      setSalary(String(existing.weekly_salary || 0));
      setCommission(String(existing.commission_percent || 0));
    } else {
      setPayModel('salary');
      setSalary('1000');
      setCommission('40');
    }
  };

  const handleSavePay = () => {
    if (!selectedProfile) return;
    upsertPay.mutate({
      profile_id: selectedProfile,
      pay_model: payModel,
      weekly_salary: Number(salary) || 0,
      commission_percent: Number(commission) || 0,
      effective_date: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleSaveCcFee = () => {
    updateCcFee.mutate(Number(localCcFee) || 3);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* CC Fee */}
          <div className="space-y-2">
            <Label>CC Fee Percentage (org-wide)</Label>
            <div className="flex gap-2">
              <Input type="number" value={localCcFee} onChange={e => setLocalCcFee(e.target.value)} className="w-24" step="0.1" min="0" max="10" />
              <span className="flex items-center text-sm text-muted-foreground">%</span>
              <Button size="sm" onClick={handleSaveCcFee} disabled={updateCcFee.isPending}>Save</Button>
            </div>
          </div>

          {/* Tech Pay Config */}
          <div className="space-y-3">
            <Label>Technician Pay Model</Label>
            <Select value={selectedProfile} onValueChange={handleSelectTech}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {[t.first_name, t.last_name].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProfile && (
              <>
                <Select value={payModel} onValueChange={(v) => setPayModel(v as 'salary' | 'commission')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary + Tips</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                  </SelectContent>
                </Select>

                {payModel === 'salary' ? (
                  <div>
                    <Label className="text-xs">Weekly Salary ($)</Label>
                    <Input type="number" value={salary} onChange={e => setSalary(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Commission (%)</Label>
                    <Input type="number" value={commission} onChange={e => setCommission(e.target.value)} step="1" min="0" max="100" />
                  </div>
                )}

                <Button onClick={handleSavePay} disabled={upsertPay.isPending} className="w-full">
                  Save Pay Config
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
