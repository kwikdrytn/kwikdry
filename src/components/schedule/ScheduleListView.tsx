import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { getStatusColor, getStatusLabel, normalizeStatus } from "@/hooks/useSchedule";
import type { HCPJob } from "@/hooks/useJobMap";

type SortKey = "date" | "customer" | "technician" | "status" | "amount";
type SortDir = "asc" | "desc";

interface Props {
  jobs: HCPJob[];
  onJobClick: (job: HCPJob) => void;
}

export function ScheduleListView({ jobs, onJobClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const arr = [...jobs];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": {
          const ad = `${a.scheduled_date ?? ""}T${a.scheduled_time ?? "00:00:00"}`;
          const bd = `${b.scheduled_date ?? ""}T${b.scheduled_time ?? "00:00:00"}`;
          cmp = ad.localeCompare(bd);
          break;
        }
        case "customer":
          cmp = (a.customer_name ?? "").localeCompare(b.customer_name ?? "");
          break;
        case "technician":
          cmp = (a.technician_name ?? "").localeCompare(b.technician_name ?? "");
          break;
        case "status":
          cmp = normalizeStatus(a.status).localeCompare(normalizeStatus(b.status));
          break;
        case "amount":
          cmp = (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [jobs, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortBtn label="Date / Time" k="date" sortKey={sortKey} onClick={toggleSort} />
            </TableHead>
            <TableHead>
              <SortBtn label="Customer" k="customer" sortKey={sortKey} onClick={toggleSort} />
            </TableHead>
            <TableHead>Address</TableHead>
            <TableHead>
              <SortBtn label="Technician" k="technician" sortKey={sortKey} onClick={toggleSort} />
            </TableHead>
            <TableHead>Services</TableHead>
            <TableHead>
              <SortBtn label="Status" k="status" sortKey={sortKey} onClick={toggleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortBtn label="Amount" k="amount" sortKey={sortKey} onClick={toggleSort} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No jobs match the current filters.
              </TableCell>
            </TableRow>
          )}
          {sorted.map((j) => {
            const color = getStatusColor(j.status);
            const services = (j.services as { name?: string }[] | null) ?? [];
            return (
              <TableRow
                key={j.id}
                className="cursor-pointer"
                onClick={() => onJobClick(j)}
              >
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium">
                    {j.scheduled_date
                      ? format(new Date(`${j.scheduled_date}T00:00:00`), "MMM d, yyyy")
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {j.scheduled_time?.slice(0, 5) ?? ""}
                    {j.scheduled_end ? `–${j.scheduled_end.slice(0, 5)}` : ""}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{j.customer_name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {j.address ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{j.technician_name ?? "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate">
                  {services.map((s) => s.name).filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ color, borderColor: `${color}60`, backgroundColor: `${color}15` }}
                  >
                    {getStatusLabel(j.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {j.total_amount != null
                    ? `$${Number(j.total_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortBtn({
  label,
  k,
  sortKey,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  onClick: (k: SortKey) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[active=true]:text-foreground"
      data-active={sortKey === k}
      onClick={() => onClick(k)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );
}
