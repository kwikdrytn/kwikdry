import { useLocation, Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { getNavItemsForPermissions } from "@/config/navigation";
import { useUserPermissions } from "@/hooks/useRoles";
import { useIncompleteTrainingCount } from "@/hooks/useIncompleteTrainingCount";
import { PanelLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import kwikDryLogo from "@/assets/KwikDryLogo.png";

export function AppSidebar() {
  const { profile } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const { data: incompleteTrainingCount = 0 } = useIncompleteTrainingCount();
  const { data: permissions } = useUserPermissions();

  const isAdmin = profile?.role === 'admin';
  
  // Get nav items based on permissions
  const navItems = getNavItemsForPermissions(
    profile?.role ?? null, 
    permissions,
    isAdmin
  );

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  };

  const getFullName = (firstName?: string | null, lastName?: string | null) => {
    return [firstName, lastName].filter(Boolean).join(' ') || 'User';
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center px-2 py-4 w-full">
          <img 
            src={kwikDryLogo} 
            alt="KwikDry Total Cleaning" 
            className="w-full h-auto max-h-14 object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter(item => item.url !== '/settings') // Settings shown in footer
                .map((item) => {
                  const showBadge = item.url === '/training' && incompleteTrainingCount > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === item.url || location.pathname.startsWith(item.url + '/')}
                        tooltip={item.title}
                      >
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {showBadge && (
                        <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                          {incompleteTrainingCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* Profile Button */}
        <Link 
          to="/settings" 
          className="group/profile flex items-center gap-3 px-2 py-3 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground group-hover/profile:text-sidebar-accent-foreground transition-colors">
                {getFullName(profile?.first_name, profile?.last_name)}
              </span>
              <span className="text-xs text-sidebar-foreground/70 group-hover/profile:text-sidebar-accent-foreground transition-colors capitalize">
                {profile?.role?.replace('_', ' ')}
              </span>
            </div>
          )}
        </Link>

        {/* Settings Button - only show if user has access */}
        {navItems.some(item => item.url === '/settings') && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={location.pathname === '/settings'}
                tooltip="Settings"
              >
                <NavLink 
                  to="/settings" 
                  className="flex items-center gap-3"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  {navItems.find(item => item.url === '/settings')?.icon && (
                    (() => {
                      const SettingsIcon = navItems.find(item => item.url === '/settings')!.icon;
                      return <SettingsIcon className="h-5 w-5" />;
                    })()
                  )}
                  <span>Settings</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Collapse/Expand Button */}
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={toggleSidebar}
                tooltip="Collapse"
              >
                <PanelLeft className="h-5 w-5" />
                <span>Collapse</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        
        {/* If no settings access, still show collapse button */}
        {!navItems.some(item => item.url === '/settings') && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={toggleSidebar}
                tooltip="Collapse"
              >
                <PanelLeft className="h-5 w-5" />
                <span>Collapse</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
