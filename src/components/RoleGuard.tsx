import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/stores/useAuthStore";
import { useUserPermissions, PermissionKey } from "@/hooks/useRoles";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: PermissionKey;
}

export function RoleGuard({ children, allowedRoles, requiredPermission }: RoleGuardProps) {
  const { profile, isLoading } = useAuth();
  const { data: permissions, isLoading: permissionsLoading, isFetching: permissionsFetching } = useUserPermissions();

  // Show loading while auth or permissions are still resolving
  if (isLoading || permissionsLoading || (requiredPermission && permissions === undefined && permissionsFetching)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  // Admins always have access
  if (profile.role === 'admin') {
    return <>{children}</>;
  }

  // Check legacy role-based access
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check granular permission if specified
  if (requiredPermission && !permissions?.includes(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
