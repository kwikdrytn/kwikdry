import { 
  LayoutDashboard, 
  Package, 
  ClipboardCheck, 
  Wrench, 
  Phone, 
  Map, 
  Settings,
  GraduationCap,
  DollarSign,
  LucideIcon
} from "lucide-react";
import { UserRole } from "@/stores/useAuthStore";
import { PermissionKey } from "@/hooks/useRoles";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Legacy role-based access - used as fallback */
  allowedRoles: UserRole[];
  /** Permission-based access - takes precedence if defined */
  requiredPermission?: PermissionKey;
}

export const navItems: NavItem[] = [
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'call_staff', 'technician'],
    requiredPermission: 'dashboard.view'
  },
  { 
    title: "Inventory", 
    url: "/inventory", 
    icon: Package,
    allowedRoles: ['admin', 'technician'],
    requiredPermission: 'inventory.view'
  },
  { 
    title: "Checklists", 
    url: "/checklists", 
    icon: ClipboardCheck,
    allowedRoles: ['admin', 'technician'],
    requiredPermission: 'checklists.submit'
  },
  { 
    title: "Equipment", 
    url: "/equipment", 
    icon: Wrench,
    allowedRoles: ['admin'],
    requiredPermission: 'equipment.view'
  },
  { 
    title: "Calls", 
    url: "/calls", 
    icon: Phone,
    allowedRoles: ['admin', 'call_staff'],
    requiredPermission: 'calls.view'
  },
  { 
    title: "Job Map", 
    url: "/job-map", 
    icon: Map,
    allowedRoles: ['admin', 'call_staff'],
    requiredPermission: 'job_map.view'
  },
  { 
    title: "Training", 
    url: "/training", 
    icon: GraduationCap,
    allowedRoles: ['admin', 'call_staff', 'technician'],
    requiredPermission: 'training.view'
  },
  { 
    title: "Payroll", 
    url: "/payroll", 
    icon: DollarSign,
    allowedRoles: ['admin'],
    requiredPermission: 'payroll.view'
  },
  { 
    title: "Settings", 
    url: "/settings", 
    icon: Settings,
    allowedRoles: ['admin', 'call_staff', 'technician'],
    requiredPermission: 'settings.view'
  },
];

/**
 * Filter navigation items based on user permissions
 * Admins get all items, others are filtered by permission
 */
export function getNavItemsForPermissions(
  role: UserRole | null, 
  permissions: PermissionKey[] | undefined,
  isAdmin: boolean
): NavItem[] {
  if (!role) return [];
  
  // Admins see everything
  if (isAdmin) {
    return navItems;
  }
  
  // Filter by permissions
  return navItems.filter(item => {
    // If no permission is required, fall back to role-based check
    if (!item.requiredPermission) {
      return item.allowedRoles.includes(role);
    }
    
    // Check if user has the required permission
    return permissions?.includes(item.requiredPermission) ?? false;
  });
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use getNavItemsForPermissions instead
 */
export function getNavItemsForRole(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return navItems.filter(item => item.allowedRoles.includes(role));
}
