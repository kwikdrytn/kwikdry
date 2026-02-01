import { 
  LayoutDashboard, 
  Package, 
  ClipboardCheck, 
  Wrench, 
  Phone, 
  Map, 
  Users, 
  MapPin, 
  Settings,
  Plug,
  LucideIcon
} from "lucide-react";
import { UserRole } from "@/stores/useAuthStore";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  allowedRoles: UserRole[];
}

export const navItems: NavItem[] = [
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'call_staff', 'technician']
  },
  { 
    title: "Inventory", 
    url: "/admin/inventory", 
    icon: Package,
    allowedRoles: ['admin', 'technician']
  },
  { 
    title: "Checklists", 
    url: "/checklists", 
    icon: ClipboardCheck,
    allowedRoles: ['technician']
  },
  { 
    title: "Checklist Review", 
    url: "/admin/checklists", 
    icon: ClipboardCheck,
    allowedRoles: ['admin']
  },
  { 
    title: "Equipment", 
    url: "/equipment", 
    icon: Wrench,
    allowedRoles: ['admin']
  },
  { 
    title: "Calls", 
    url: "/admin/calls", 
    icon: Phone,
    allowedRoles: ['admin', 'call_staff']
  },
  { 
    title: "Job Map", 
    url: "/job-map", 
    icon: Map,
    allowedRoles: ['admin', 'call_staff']
  },
  { 
    title: "Users", 
    url: "/admin/users", 
    icon: Users,
    allowedRoles: ['admin']
  },
  { 
    title: "Locations", 
    url: "/locations", 
    icon: MapPin,
    allowedRoles: ['admin']
  },
  { 
    title: "Settings", 
    url: "/settings", 
    icon: Settings,
    allowedRoles: ['admin']
  },
  { 
    title: "Integrations", 
    url: "/admin/settings/integrations", 
    icon: Plug,
    allowedRoles: ['admin']
  },
];

export function getNavItemsForRole(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return navItems.filter(item => item.allowedRoles.includes(role));
}
