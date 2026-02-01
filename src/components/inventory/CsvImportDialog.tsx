import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  X 
} from "lucide-react";
import { InventoryCategory, InventoryUnit } from "@/hooks/useInventory";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ParsedItem[]) => void;
  isLoading?: boolean;
}

export interface ParsedItem {
  name: string;
  description?: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  reorder_threshold: number;
  par_level?: number | null;
}

type FieldKey = 'name' | 'description' | 'category' | 'unit' | 'reorder_threshold' | 'par_level';

interface FieldMapping {
  field: FieldKey;
  label: string;
  required: boolean;
  csvHeader: string | null;
}

const INVENTORY_FIELDS: Omit<FieldMapping, 'csvHeader'>[] = [
  { field: 'name', label: 'Name', required: true },
  { field: 'description', label: 'Description', required: false },
  { field: 'category', label: 'Category', required: true },
  { field: 'unit', label: 'Unit', required: true },
  { field: 'reorder_threshold', label: 'Reorder Threshold', required: true },
  { field: 'par_level', label: 'Par Level', required: false },
];

const CATEGORY_MAP: Record<string, InventoryCategory> = {
  'cleaning_solution': 'cleaning_solution',
  'cleaning solution': 'cleaning_solution',
  'solution': 'cleaning_solution',
  'supply': 'supply',
  'supplies': 'supply',
  'consumable': 'consumable',
  'consumables': 'consumable',
};

const UNIT_MAP: Record<string, InventoryUnit> = {
  'gallon': 'gallon',
  'gallons': 'gallon',
  'gal': 'gallon',
  'oz': 'oz',
  'ounce': 'oz',
  'ounces': 'oz',
  'liter': 'liter',
  'liters': 'liter',
  'l': 'liter',
  'ml': 'ml',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'each': 'each',
  'ea': 'each',
  'box': 'box',
  'boxes': 'box',
  'case': 'case',
  'cases': 'case',
  'roll': 'roll',
  'rolls': 'roll',
  'bag': 'bag',
  'bags': 'bag',
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

function autoMapHeaders(csvHeaders: string[]): Record<FieldKey, string | null> {
  const mapping: Record<FieldKey, string | null> = {
    name: null,
    description: null,
    category: null,
    unit: null,
    reorder_threshold: null,
    par_level: null,
  };

  const lowerHeaders = csvHeaders.map(h => h.toLowerCase().trim());

  // Auto-match common header names
  lowerHeaders.forEach((header, index) => {
    const originalHeader = csvHeaders[index];
    
    if (['name', 'item name', 'item_name', 'product', 'product name'].includes(header)) {
      mapping.name = originalHeader;
    } else if (['description', 'desc', 'details'].includes(header)) {
      mapping.description = originalHeader;
    } else if (['category', 'type', 'item type', 'item_type'].includes(header)) {
      mapping.category = originalHeader;
    } else if (['unit', 'uom', 'unit of measure', 'units'].includes(header)) {
      mapping.unit = originalHeader;
    } else if (['reorder_threshold', 'reorder threshold', 'reorder', 'min stock', 'minimum'].includes(header)) {
      mapping.reorder_threshold = originalHeader;
    } else if (['par_level', 'par level', 'par', 'max stock', 'maximum', 'target'].includes(header)) {
      mapping.par_level = originalHeader;
    }
  });

  return mapping;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onImport,
  isLoading,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<FieldKey, string | null>>({
    name: null,
    description: null,
    category: null,
    unit: null,
    reorder_threshold: null,
    par_level: null,
  });
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      
      if (parsed.headers.length === 0) {
        setError('CSV file appears to be empty');
        return;
      }

      setCsvData(parsed);
      setMapping(autoMapHeaders(parsed.headers));
    } catch (err) {
      setError('Failed to parse CSV file');
    }
  }, []);

  const handleMappingChange = (field: FieldKey, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === '__none__' ? null : value,
    }));
  };

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!mapping.name) errors.push('Name field is required');
    if (!mapping.category) errors.push('Category field is required');
    if (!mapping.unit) errors.push('Unit field is required');
    if (!mapping.reorder_threshold) errors.push('Reorder Threshold field is required');
    return errors;
  }, [mapping]);

  const parsedItems = useMemo((): { items: ParsedItem[]; warnings: string[] } => {
    if (!csvData || validationErrors.length > 0) return { items: [], warnings: [] };

    const items: ParsedItem[] = [];
    const warnings: string[] = [];

    csvData.rows.forEach((row, rowIndex) => {
      const getValue = (field: FieldKey): string => {
        const header = mapping[field];
        if (!header) return '';
        const headerIndex = csvData.headers.indexOf(header);
        return headerIndex >= 0 ? (row[headerIndex] || '').trim() : '';
      };

      const name = getValue('name');
      if (!name) {
        warnings.push(`Row ${rowIndex + 2}: Skipped - no name`);
        return;
      }

      const categoryRaw = getValue('category').toLowerCase();
      const category = CATEGORY_MAP[categoryRaw];
      if (!category) {
        warnings.push(`Row ${rowIndex + 2}: Invalid category "${getValue('category')}" - defaulting to "supply"`);
      }

      const unitRaw = getValue('unit').toLowerCase();
      const unit = UNIT_MAP[unitRaw];
      if (!unit) {
        warnings.push(`Row ${rowIndex + 2}: Invalid unit "${getValue('unit')}" - defaulting to "each"`);
      }

      const reorderThreshold = parseFloat(getValue('reorder_threshold')) || 0;
      const parLevelStr = getValue('par_level');
      const parLevel = parLevelStr ? parseFloat(parLevelStr) || null : null;

      items.push({
        name,
        description: getValue('description') || undefined,
        category: category || 'supply',
        unit: unit || 'each',
        reorder_threshold: reorderThreshold,
        par_level: parLevel,
      });
    });

    return { items, warnings };
  }, [csvData, mapping, validationErrors]);

  const handleImport = () => {
    if (parsedItems.items.length > 0) {
      onImport(parsedItems.items);
    }
  };

  const handleClose = () => {
    setFile(null);
    setCsvData(null);
    setMapping({
      name: null,
      description: null,
      category: null,
      unit: null,
      reorder_threshold: null,
      par_level: null,
    });
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Inventory Items
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file and map the columns to inventory fields.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 pr-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>CSV File</Label>
              {!file ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload CSV</span>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      setCsvData(null);
                      setError(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Column Mapping */}
            {csvData && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Map CSV Columns</h4>
                  <p className="text-xs text-muted-foreground">
                    Match your CSV headers to inventory fields. Required fields are marked with *.
                  </p>
                </div>

                <div className="grid gap-3">
                  {INVENTORY_FIELDS.map(({ field, label, required }) => (
                    <div key={field} className="grid grid-cols-2 gap-3 items-center">
                      <Label className="text-sm">
                        {label} {required && <span className="text-destructive">*</span>}
                      </Label>
                      <Select
                        value={mapping[field] ?? '__none__'}
                        onValueChange={(value) => handleMappingChange(field, value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Not mapped --</SelectItem>
                          {csvData.headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc pl-4 text-sm">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validationErrors.length === 0 && parsedItems.items.length > 0 && (
                  <Alert className="border-primary/50 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-primary">
                      Ready to import {parsedItems.items.length} item(s)
                      {parsedItems.warnings.length > 0 && (
                        <span className="text-muted-foreground">
                          {' '}with {parsedItems.warnings.length} warning(s)
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {parsedItems.warnings.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
                    {parsedItems.warnings.slice(0, 5).map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                    {parsedItems.warnings.length > 5 && (
                      <p>...and {parsedItems.warnings.length - 5} more warnings</p>
                    )}
                  </div>
                )}

                {/* Preview */}
                {parsedItems.items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Preview (first 3 rows)</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">Name</th>
                            <th className="px-2 py-1.5 text-left font-medium">Category</th>
                            <th className="px-2 py-1.5 text-left font-medium">Unit</th>
                            <th className="px-2 py-1.5 text-right font-medium">Reorder</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedItems.items.slice(0, 3).map((item, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1.5">{item.name}</td>
                              <td className="px-2 py-1.5 capitalize">{item.category.replace('_', ' ')}</td>
                              <td className="px-2 py-1.5">{item.unit}</td>
                              <td className="px-2 py-1.5 text-right">{item.reorder_threshold}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || validationErrors.length > 0 || parsedItems.items.length === 0}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {parsedItems.items.length} Item(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
