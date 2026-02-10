import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CalendarIcon,
  DollarSign,
  Users,
  Briefcase,
  CreditCard,
} from "lucide-react";
import {
  usePayrollReport,
  getWeekRange,
  type TechnicianPayrollSummary,
} from "@/hooks/usePayrollReport";
import { format, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function PaymentMethodBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-muted-foreground text-xs">—</span>;
  const label = method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {label}
    </Badge>
  );
}

function TechnicianRow({ tech }: { tech: TechnicianPayrollSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {open ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {tech.technicianName}
            </div>
          </TableCell>
          <TableCell className="text-center">{tech.jobCount}</TableCell>
          <TableCell className="text-right">{formatCurrency(tech.totalRevenue)}</TableCell>
          <TableCell className="text-right">{formatCurrency(tech.totalTips)}</TableCell>
          <TableCell className="text-right text-destructive">
            {formatCurrency(tech.totalCcFees)}
          </TableCell>
          <TableCell className="text-right font-semibold">
            {formatCurrency(tech.netRevenue)}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <>
          {tech.jobs.map((job) => {
            const serviceNames =
              Array.isArray(job.services)
                ? job.services
                    .map((s: any) => s.name)
                    .filter(Boolean)
                    .join(", ")
                : "—";
            return (
              <TableRow key={job.id} className="bg-muted/30">
                <TableCell className="pl-10 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">{job.customer_name || "—"}</span>
                    <br />
                    <span className="text-xs">
                      {job.scheduled_date
                        ? format(new Date(job.scheduled_date + "T00:00:00"), "MMM d, yyyy")
                        : "—"}{" "}
                      · {serviceNames}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <PaymentMethodBadge method={job.payment_method} />
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(job.total_amount || 0)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(job.tip_amount || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-destructive">
                  {formatCurrency(job.cc_fee_amount || 0)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatCurrency((job.total_amount || 0) - (job.cc_fee_amount || 0))}
                </TableCell>
              </TableRow>
            );
          })}
        </>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PayrollReports() {
  const [mode, setMode] = useState<"week" | "custom">("week");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  const { start: weekStart, end: weekEnd } = useMemo(
    () => getWeekRange(weekAnchor),
    [weekAnchor]
  );

  const startDate = mode === "week" ? weekStart : customStart || weekStart;
  const endDate = mode === "week" ? weekEnd : customEnd || weekEnd;

  const { data, isLoading } = usePayrollReport({ startDate, endDate });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payroll Reports</h1>
            <p className="text-muted-foreground text-sm">
              Revenue, tips, and credit card fees per technician
            </p>
          </div>

          {/* Date mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("week")}
            >
              Weekly
            </Button>
            <Button
              variant={mode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("custom");
                if (!customStart) setCustomStart(weekStart);
                if (!customEnd) setCustomEnd(weekEnd);
              }}
            >
              Custom Range
            </Button>
          </div>
        </div>

        {/* Date controls */}
        <Card>
          <CardContent className="py-3">
            {mode === "week" ? (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <span className="font-semibold">
                    {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {customStart ? format(customStart, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStart}
                      onSelect={setCustomStart}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {customEnd ? format(customEnd, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEnd}
                      onSelect={setCustomEnd}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary cards */}
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{data.grandTotals.jobCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data.grandTotals.totalRevenue)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-accent p-2">
                  <Users className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tips</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data.grandTotals.totalTips)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <CreditCard className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CC Fees</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(data.grandTotals.totalCcFees)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technician Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !data || data.technicians.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No completed jobs found for this period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-center">Jobs</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Tips</TableHead>
                    <TableHead className="text-right">CC Fees</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.technicians.map((tech) => (
                    <TechnicianRow key={tech.technicianHcpId || tech.technicianName} tech={tech} />
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-center">{data.grandTotals.jobCount}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.grandTotals.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.grandTotals.totalTips)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatCurrency(data.grandTotals.totalCcFees)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.grandTotals.netRevenue)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
