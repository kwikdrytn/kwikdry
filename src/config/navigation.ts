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
    url: "/inventory", 
    icon: Package,
    allowedRoles: ['admin', 'technician']
  },
  { 
    title: "Checklists", 
    url: "/checklists", 
    icon: ClipboardCheck,
    allowedRoles: ['admin', 'technician']
  },
  { 
    title: "Equipment", 
    url: "/equipment", 
    icon: Wrench,
    allowedRoles: ['admin']
  },
  { 
    title: "Calls", 
    url: "/calls", 
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
    url: "/users", 
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
];

export function getNavItemsForRole(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return navItems.filter(item => item.allowedRoles.includes(role));
}
