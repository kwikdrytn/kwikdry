import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Search,
  X,
  Filter,
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import {
  ScheduleFilters as TFilters,
  ScheduleViewMode,
  SCHEDULE_STATUSES,
  countActive,
} from "@/hooks/useSchedule";
import { useTechnicians, useServiceTypes } from "@/hooks/useJobMap";

interface Props {
  filters: TFilters;
  onChange: (next: TFilters) => void;
}

export function ScheduleFiltersBar({ filters, onChange }: Props) {
  const { data: techs = [] } = useTechnicians();
  const { data: services = [] } = useServiceTypes();

  const update = (patch: Partial<TFilters>) => onChange({ ...filters, ...patch });

  const goPrev = () => {
    const delta = filters.view === "week" ? -7 : -1;
    update({ date: addDays(filters.date, delta) });
  };
  const goNext = () => {
    const delta = filters.view === "week" ? 7 : 1;
    update({ date: addDays(filters.date, delta) });
  };
  const goToday = () => update({ date: new Date() });

  const setView = (view: ScheduleViewMode) => update({ view });

  const toggleArrayItem = (
    key: "technicians" | "statuses" | "serviceTypes",
    value: string,
    all: string[],
  ) => {
    const current = filters[key];
    let next: string[];
    if (value === "all") {
      next = ["all"];
    } else {
      const without = current.filter((v) => v !== "all" && v !== value);
      if (current.includes(value)) {
        next = without.length ? without : ["all"];
      } else {
        next = [...without, value];
        if (next.length === all.length) next = ["all"];
      }
    }
    update({ [key]: next } as Partial<TFilters>);
  };

  const dateLabel =
    filters.view === "week"
      ? `${format(startOfWeek(filters.date, { weekStartsOn: 0 }), "MMM d")} – ${format(
          endOfWeek(filters.date, { weekStartsOn: 0 }),
          "MMM d, yyyy",
        )}`
      : format(filters.date, "EEE, MMM d, yyyy");

  const activeCount = countActive(filters);

  return (
    <div className="flex flex-col gap-3 border-b bg-background/95 backdrop-blur px-4 py-3 sticky top-0 z-20">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-start">
                <CalendarIcon className="h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.date}
                onSelect={(d) => d && update({ date: d })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="inline-flex rounded-md border bg-muted p-0.5">
          {(["day", "week", "list"] as ScheduleViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm font-medium rounded capitalize transition-colors ${
                filters.view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search customer, address, job ID..."
            className="pl-8"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Technicians */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-3.5 w-3.5" />
              Technicians
              {!filters.technicians.includes("all") && (
                <Badge variant="secondary" className="h-5 px-1.5">
                  {filters.technicians.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="p-2 max-h-72 overflow-y-auto">
              <FilterRow
                label="All technicians"
                checked={filters.technicians.includes("all")}
                onCheckedChange={() => toggleArrayItem("technicians", "all", techs.map((t) => t.id))}
              />
              <FilterRow
                label="Unassigned"
                checked={filters.technicians.includes("unassigned")}
                onCheckedChange={() =>
                  toggleArrayItem("technicians", "unassigned", techs.map((t) => t.id))
                }
              />
              <div className="my-1 border-t" />
              {techs.map((t) => (
                <FilterRow
                  key={t.id}
                  label={t.name}
                  checked={filters.technicians.includes(t.id)}
                  onCheckedChange={() => toggleArrayItem("technicians", t.id, techs.map((x) => x.id))}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-3.5 w-3.5" />
              Status
              {!filters.statuses.includes("all") && (
                <Badge variant="secondary" className="h-5 px-1.5">
                  {filters.statuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <FilterRow
              label="All statuses"
              checked={filters.statuses.includes("all")}
              onCheckedChange={() =>
                toggleArrayItem("statuses", "all", SCHEDULE_STATUSES.map((s) => s.value))
              }
            />
            <div className="my-1 border-t" />
            {SCHEDULE_STATUSES.map((s) => (
              <FilterRow
                key={s.value}
                label={s.label}
                checked={filters.statuses.includes(s.value)}
                onCheckedChange={() =>
                  toggleArrayItem("statuses", s.value, SCHEDULE_STATUSES.map((x) => x.value))
                }
                dotColor={s.color}
              />
            ))}
          </PopoverContent>
        </Popover>

        {/* Services */}
        {services.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-3.5 w-3.5" />
                Services
                {!filters.serviceTypes.includes("all") && (
                  <Badge variant="secondary" className="h-5 px-1.5">
                    {filters.serviceTypes.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 max-h-72 overflow-y-auto">
                <FilterRow
                  label="All services"
                  checked={filters.serviceTypes.includes("all")}
                  onCheckedChange={() => toggleArrayItem("serviceTypes", "all", services)}
                />
                <div className="my-1 border-t" />
                {services.map((s) => (
                  <FilterRow
                    key={s}
                    label={s}
                    checked={filters.serviceTypes.includes(s)}
                    onCheckedChange={() => toggleArrayItem("serviceTypes", s, services)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              update({
                technicians: ["all"],
                statuses: ["all"],
                serviceTypes: ["all"],
                search: "",
              })
            }
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  checked,
  onCheckedChange,
  dotColor,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  dotColor?: string;
}) {
  const id = `f-${label.replace(/\s+/g, "-")}`;
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent cursor-pointer"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      {dotColor && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      )}
      <span className="truncate">{label}</span>
    </label>
  );
}
