import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { LocationWithTeamCount } from "@/hooks/useLocations";

interface DeactivateLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationWithTeamCount | null;
  onConfirm: () => void;
  isDeactivating: boolean;
}

export function DeactivateLocationDialog({
  open,
  onOpenChange,
  location,
  onConfirm,
  isDeactivating,
}: DeactivateLocationDialogProps) {
  if (!location) return null;

  const hasTeamMembers = location.team_count > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Location</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate <strong>{location.name}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasTeamMembers && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This location has <strong>{location.team_count}</strong> active team member(s) assigned.
              You must reassign them to another location before deactivating.
            </AlertDescription>
          </Alert>
        )}

        {!hasTeamMembers && (
          <p className="text-sm text-muted-foreground">
            This action will hide the location from selection dropdowns. You can restore it later if needed.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={hasTeamMembers || isDeactivating}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeactivating ? "Deactivating..." : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
