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
import { UserProfile } from "@/hooks/useUsers";

interface DeactivateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeactivateUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isLoading,
}: DeactivateUserDialogProps) {
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'this user';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate <strong>{userName}</strong>? 
            They will no longer be able to access the system. This action can be reversed by an administrator.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
