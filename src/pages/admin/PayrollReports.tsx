import { useState, useMemo } from "react";
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
import { Fragment } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarIcon, Settings2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePayrollReport, useOrgPaySettings, useUpdateOrgPaySettings, TechnicianPayroll } from "@/hooks/usePayrollReport";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return '-';
  const lower = method.toLowerCase();
  if (lower.includes('credit') || lower === 'credit_card') return 'Credit Card';
  if (lower.includes('external') || lower === 'cash' || lower === 'check') return 'Cash/Check';
  return method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getDisplayJobAmount(totalAmount: number | null, tipAmount: number | null): number {
  const total = Number(totalAmount) || 0;
  const tip = Number(tipAmount) || 0;
  if (tip <= 0) return total;
  return Math.max(total - tip, 0);
}

function getPayModelLabel(tech: TechnicianPayroll): string {
  if (tech.guaranteeWeeks > 0 && tech.commissionWeeks > 0) {
    return 'Mixed';
  }
  if (tech.guaranteeWeeks > 0) return 'Guarantee';
  return 'Commission';
}

function getPayModelVariant(tech: TechnicianPayroll): 'default' | 'secondary' | 'outline' {
  if (tech.guaranteeWeeks > 0 && tech.commissionWeeks === 0) return 'secondary';
  return 'outline';
}

export default function PayrollReports() {
  const [mode, setMode] = useState<'weekly' | 'custom'>('weekly');
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 });

  const startDate = mode === 'weekly' ? format(weekStart, 'yyyy-MM-dd') : (customStart ? format(customStart, 'yyyy-MM-dd') : '');
  const endDate = mode === 'weekly' ? format(weekEnd, 'yyyy-MM-dd') : (customEnd ? format(customEnd, 'yyyy-MM-dd') : '');

  const { data: payrollData, isLoading } = usePayrollReport(startDate, endDate);
  const { data: orgSettings } = useOrgPaySettings();

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
            <p className="text-muted-foreground text-sm">
              {orgSettings ? `${orgSettings.commission_percent}% Commission (min ${formatCurrency(orgSettings.weekly_minimum)}/week) + Tips - CC Fees` : 'Revenue, tips, and CC fees by technician'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={syncing} onClick={async () => {
              setSyncing(true);
              try {
                const { error } = await supabase.functions.invoke('sync-hcp-data');
                if (error) throw error;
                toast.success('HCP data synced successfully');
                queryClient.invalidateQueries({ queryKey: ['payroll-report'] });
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
                CC Fee: {orgSettings?.cc_fee_percent ?? 3.49}%
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
              <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{tableLayout: 'fixed'}}>
                <colgroup>
                  <col style={{width: '18%'}} />
                  <col style={{width: '8%'}} />
                  <col style={{width: '14%'}} />
                  <col style={{width: '12%'}} />
                  <col style={{width: '12%'}} />
                  <col style={{width: '14%'}} />
                  <col style={{width: '14%'}} />
                  <col style={{width: '8%'}} />
                </colgroup>
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">Technician</th>
                    <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">Jobs</th>
                    <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">Revenue</th>
                    <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">Tips</th>
                    <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">CC Fees</th>
                    <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">Net Pay</th>
                    <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">Pay Type</th>
                    <th className="py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map(tech => {
                    const isExpanded = expandedTech === tech.technician_hcp_id;
                    return (
                    <Fragment key={tech.technician_hcp_id}>
                      <tr className="border-b cursor-pointer hover:bg-muted/50" onClick={() => setExpandedTech(isExpanded ? null : tech.technician_hcp_id)}>
                        <td className="py-3 px-3 font-medium">{tech.technician_name}</td>
                        <td className="py-3 px-3 text-center">{tech.jobCount}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(tech.grossRevenue)}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(tech.totalTips)}</td>
                        <td className="py-3 px-3 text-right text-destructive">-{formatCurrency(tech.ccFeesOnRevenue + tech.ccFeesOnTips)}</td>
                        <td className="py-3 px-3 text-right font-semibold">{formatCurrency(tech.netPay)}</td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={getPayModelVariant(tech)} className="text-xs">
                            {getPayModelLabel(tech)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div className="bg-muted/30 px-6 py-3 overflow-x-auto">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {tech.commissionPercent}% Commission (min {formatCurrency(tech.weeklyMinimum)}/week) + Tips - CC Fees on Tips
                                {tech.guaranteeWeeks > 0 && tech.commissionWeeks > 0 && (
                                  <span className="ml-2">
                                    ({tech.guaranteeWeeks} guarantee wk{tech.guaranteeWeeks !== 1 ? 's' : ''}, {tech.commissionWeeks} commission wk{tech.commissionWeeks !== 1 ? 's' : ''})
                                  </span>
                                )}
                                <span className="ml-2">• Base Pay: {formatCurrency(tech.basePay)}</span>
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 w-[14%]">Date</th>
                                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 w-[18%]">Customer</th>
                                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4 w-[22%]">Service</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground py-2 pr-4 w-[12%]">Amount</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground py-2 pr-4 w-[10%]">Tip</th>
                                    <th className="text-right text-xs font-medium text-muted-foreground py-2 pr-4 w-[10%]">CC Fees</th>
                                    <th className="text-left text-xs font-medium text-muted-foreground py-2 w-[14%]">Payment</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tech.jobs.map(job => {
                                    const rawTotal = Number(job.total_amount) || 0;
                                    const jobTip = Number(job.tip_amount) || 0;
                                    const jobAmount = getDisplayJobAmount(rawTotal, jobTip);
                                    const isCard = job.payment_method?.toLowerCase().includes('credit') || job.payment_method === 'credit_card';
                                    const jobCcFee = Number(job.cc_fee_amount) || (isCard ? (rawTotal || (jobAmount + jobTip)) * ((orgSettings?.cc_fee_percent ?? 3.49) / 100) : 0);
                                    return (
                                    <tr key={job.id} className="border-b last:border-0 text-xs">
                                      <td className="py-2 pr-4">{job.scheduled_date ? format(new Date(job.scheduled_date + 'T12:00:00'), 'MMM d') : '-'}</td>
                                      <td className="py-2 pr-4">{job.customer_name || '-'}</td>
                                      <td className="py-2 pr-4 max-w-[200px] truncate">
                                        {Array.isArray(job.services) ? job.services.map((s: any) => s.name).filter(Boolean).join(', ') : '-'}
                                      </td>
                                      <td className="py-2 pr-4 text-right">{formatCurrency(jobAmount)}</td>
                                      <td className="py-2 pr-4 text-right">{jobTip ? formatCurrency(jobTip) : '-'}</td>
                                      <td className="py-2 pr-4 text-right text-destructive">{jobCcFee ? `-${formatCurrency(jobCcFee)}` : '-'}</td>
                                      <td className="py-2">{formatPaymentMethod(job.payment_method)}</td>
                                    </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/50">
                  <tr className="font-bold">
                    <td className="py-3 px-3">Totals</td>
                    <td className="py-3 px-3 text-center">{totals.jobs}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(totals.revenue)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(totals.tips)}</td>
                    <td className="py-3 px-3 text-right text-destructive">-{formatCurrency(totals.ccFees)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(totals.netPay)}</td>
                    <td className="py-3 px-3" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PaySettingsDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
    </DashboardLayout>
  );
}

function PaySettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: settings } = useOrgPaySettings();
  const updateSettings = useUpdateOrgPaySettings();

  const [ccFee, setCcFee] = useState('');
  const [minimum, setMinimum] = useState('');
  const [commission, setCommission] = useState('');

  // Sync local state when settings load
  const initialized = useState(false);
  if (settings && !initialized[0]) {
    setCcFee(String(settings.cc_fee_percent));
    setMinimum(String(settings.weekly_minimum));
    setCommission(String(settings.commission_percent));
    initialized[1](true);
  }

  // Also update when dialog opens with fresh data
  const handleOpenChange = (v: boolean) => {
    if (v && settings) {
      setCcFee(String(settings.cc_fee_percent));
      setMinimum(String(settings.weekly_minimum));
      setCommission(String(settings.commission_percent));
    }
    onOpenChange(v);
  };

  const handleSave = () => {
    updateSettings.mutate({
      cc_fee_percent: Number(ccFee) || 3.49,
      weekly_minimum: Number(minimum) || 1000,
      commission_percent: Number(commission) || 40,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm">Commission Rate (%)</Label>
            <Input type="number" value={commission} onChange={e => setCommission(e.target.value)} step="1" min="0" max="100" />
            <p className="text-xs text-muted-foreground">Applied to job revenue each week</p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Weekly Minimum ($)</Label>
            <Input type="number" value={minimum} onChange={e => setMinimum(e.target.value)} step="50" min="0" />
            <p className="text-xs text-muted-foreground">Guaranteed minimum base pay per week</p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">CC Fee (%)</Label>
            <Input type="number" value={ccFee} onChange={e => setCcFee(e.target.value)} step="0.1" min="0" max="10" />
            <p className="text-xs text-muted-foreground">Deducted from tips on card payments</p>
          </div>
          <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
