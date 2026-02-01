import { useState } from "react";
import { ChecklistItem } from "@/hooks/useChecklists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistFormProps {
  items: ChecklistItem[];
  onSubmit: (responses: Record<string, { value: string; image_url?: string; notes?: string }>, notes?: string) => void;
  isSubmitting: boolean;
}

export function ChecklistForm({ items, onSubmit, isSubmitting }: ChecklistFormProps) {
  const [responses, setResponses] = useState<Record<string, { value: string; image_url?: string; notes?: string }>>({});
  const [generalNotes, setGeneralNotes] = useState("");

  const handleValueChange = (key: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  };

  const handleNotesChange = (key: string, notes: string) => {
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  };

  const handleImageCapture = async (key: string) => {
    // For now, simulate image capture - in production this would use camera API
    const mockImageUrl = `https://placeholder.co/400x300?text=Photo+${key}`;
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], image_url: mockImageUrl },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(responses, generalNotes);
  };

  const isComplete = items.every((item) => {
    if (!item.required) return true;
    const response = responses[item.key];
    if (!response?.value) return false;
    if (item.photo_required && !response.image_url) return false;
    return true;
  });

  const completedCount = items.filter((item) => {
    const response = responses[item.key];
    if (!response?.value) return false;
    if (item.photo_required && !response.image_url) return false;
    return true;
  }).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
        <span className="text-sm font-medium">Progress</span>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {items.length} items completed
        </span>
      </div>

      {items.map((item, index) => {
        const response = responses[item.key];
        const hasValue = !!response?.value;
        const hasPhoto = !!response?.image_url;
        const itemComplete = hasValue && (!item.photo_required || hasPhoto);

        return (
          <Card key={item.key} className={cn(itemComplete && "border-success/50 bg-success/5")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {index + 1}
                </span>
                {item.label}
                {item.required && <span className="text-destructive">*</span>}
                {itemComplete && <CheckCircle2 className="ml-auto h-5 w-5 text-success" />}
              </CardTitle>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {item.type === "boolean" && (
                <Button
                  type="button"
                  variant={response?.value === "true" ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => handleValueChange(item.key, response?.value === "true" ? "false" : "true")}
                >
                  <Check className="h-4 w-4" />
                  {response?.value === "true" ? "Checked" : "Check"}
                </Button>
              )}

              {item.type === "text" && (
                <Input
                  placeholder="Enter your response..."
                  value={response?.value || ""}
                  onChange={(e) => handleValueChange(item.key, e.target.value)}
                />
              )}

              {item.type === "number" && (
                <Input
                  type="number"
                  placeholder="Enter a number..."
                  value={response?.value || ""}
                  onChange={(e) => handleValueChange(item.key, e.target.value)}
                />
              )}

              {item.type === "select" && (
                <Select
                  value={response?.value || ""}
                  onValueChange={(value) => handleValueChange(item.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {item.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {item.type === "photo" && (
                <div className="space-y-2">
                  {response?.image_url ? (
                    <div className="relative">
                      <img
                        src={response.image_url}
                        alt="Captured"
                        className="h-32 w-full rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => handleImageCapture(item.key)}
                      >
                        Retake
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleImageCapture(item.key)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </Button>
                  )}
                </div>
              )}

              {item.photo_required && item.type !== "photo" && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Photo required</Label>
                  {response?.image_url ? (
                    <div className="relative">
                      <img
                        src={response.image_url}
                        alt="Captured"
                        className="h-24 w-full rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => handleImageCapture(item.key)}
                      >
                        Retake
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleImageCapture(item.key)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Add Photo
                    </Button>
                  )}
                </div>
              )}

              <div className="pt-2">
                <Label className="text-sm text-muted-foreground">Notes (optional)</Label>
                <Textarea
                  placeholder="Add any notes..."
                  value={response?.notes || ""}
                  onChange={(e) => handleNotesChange(item.key, e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any general notes about this checklist..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={!isComplete || isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Checklist"
        )}
      </Button>
    </form>
  );
}
