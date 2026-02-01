import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { InventoryCategory, InventoryUnit } from "@/hooks/useInventory";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSave: (updates: BulkEditUpdates) => void;
  isLoading?: boolean;
}

export interface BulkEditUpdates {
  category?: InventoryCategory;
  unit?: InventoryUnit;
  reorder_threshold?: number;
  par_level?: number | null;
  expiration_date?: string | null;
  notes?: string;
}

const categoryLabels: Record<InventoryCategory, string> = {
  cleaning_solution: "Cleaning Solution",
  supply: "Supply",
  consumable: "Consumable",
};

const unitLabels: Record<InventoryUnit, string> = {
  gallon: "Gallon",
  oz: "Ounce (oz)",
  liter: "Liter",
  ml: "Milliliter (ml)",
  each: "Each",
  box: "Box",
  case: "Case",
  roll: "Roll",
  bag: "Bag",
};

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedCount,
  onSave,
  isLoading,
}: BulkEditDialogProps) {
  // Track which fields should be updated
  const [enableCategory, setEnableCategory] = useState(false);
  const [enableUnit, setEnableUnit] = useState(false);
  const [enableReorderThreshold, setEnableReorderThreshold] = useState(false);
  const [enableParLevel, setEnableParLevel] = useState(false);
  const [enableExpirationDate, setEnableExpirationDate] = useState(false);
  const [enableNotes, setEnableNotes] = useState(false);

  // Field values
  const [category, setCategory] = useState<InventoryCategory>("supply");
  const [unit, setUnit] = useState<InventoryUnit>("each");
  const [reorderThreshold, setReorderThreshold] = useState(0);
  const [parLevel, setParLevel] = useState<number | undefined>(undefined);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    const updates: BulkEditUpdates = {};

    if (enableCategory) updates.category = category;
    if (enableUnit) updates.unit = unit;
    if (enableReorderThreshold) updates.reorder_threshold = reorderThreshold;
    if (enableParLevel) updates.par_level = parLevel ?? null;
    if (enableExpirationDate) {
      updates.expiration_date = expirationDate 
        ? format(expirationDate, "yyyy-MM-dd") 
        : null;
    }
    if (enableNotes) updates.notes = notes;

    onSave(updates);
  };

  const hasChanges = enableCategory || enableUnit || enableReorderThreshold || 
                     enableParLevel || enableExpirationDate || enableNotes;

  const resetForm = () => {
    setEnableCategory(false);
    setEnableUnit(false);
    setEnableReorderThreshold(false);
    setEnableParLevel(false);
    setEnableExpirationDate(false);
    setEnableNotes(false);
    setCategory("supply");
    setUnit("each");
    setReorderThreshold(0);
    setParLevel(undefined);
    setExpirationDate(undefined);
    setNotes("");
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit Items</DialogTitle>
          <DialogDescription>
            Edit {selectedCount} selected item{selectedCount !== 1 ? "s" : ""}. 
            Only checked fields will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-category"
              checked={enableCategory}
              onCheckedChange={(checked) => setEnableCategory(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-category" className="cursor-pointer">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as InventoryCategory)}
                disabled={!enableCategory}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unit */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-unit"
              checked={enableUnit}
              onCheckedChange={(checked) => setEnableUnit(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-unit" className="cursor-pointer">
                Unit
              </Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as InventoryUnit)}
                disabled={!enableUnit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(unitLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reorder Threshold */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-reorder"
              checked={enableReorderThreshold}
              onCheckedChange={(checked) => setEnableReorderThreshold(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-reorder" className="cursor-pointer">
                Reorder Threshold
              </Label>
              <Input
                type="number"
                min={0}
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(Number(e.target.value))}
                disabled={!enableReorderThreshold}
              />
            </div>
          </div>

          {/* Par Level */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-par"
              checked={enableParLevel}
              onCheckedChange={(checked) => setEnableParLevel(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-par" className="cursor-pointer">
                Par Level
              </Label>
              <Input
                type="number"
                min={0}
                value={parLevel ?? ""}
                onChange={(e) => setParLevel(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Optional"
                disabled={!enableParLevel}
              />
            </div>
          </div>

          {/* Expiration Date */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-expiration"
              checked={enableExpirationDate}
              onCheckedChange={(checked) => setEnableExpirationDate(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-expiration" className="cursor-pointer">
                Expiration Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expirationDate && "text-muted-foreground"
                    )}
                    disabled={!enableExpirationDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expirationDate ? format(expirationDate, "PPP") : "Select date (or leave empty to clear)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expirationDate}
                    onSelect={setExpirationDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {enableExpirationDate && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setExpirationDate(undefined)}
                  className="text-xs"
                >
                  Clear date
                </Button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="enable-notes"
              checked={enableNotes}
              onCheckedChange={(checked) => setEnableNotes(!!checked)}
              className="mt-2.5"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="enable-notes" className="cursor-pointer">
                Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add or replace notes for selected items"
                disabled={!enableNotes}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isLoading}
          >
            {isLoading ? "Updating..." : `Update ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
