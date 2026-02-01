import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getNavItemsForRole } from "@/config/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();

  // Get nav items for role, limit to 4 main items + settings
  const allNavItems = getNavItemsForRole(profile?.role ?? null).filter(
    item => item.url !== '/settings'
  );
  
  // Take first 4 items to fit nicely in bottom nav
  const navItems = allNavItems.slice(0, 4);

  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
              isActive(item.url)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive(item.url) && "text-primary")} />
            <span className="truncate max-w-[64px]">{item.title}</span>
          </Link>
        ))}
        <Link
          to="/settings"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
            isActive('/settings')
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className={cn("h-5 w-5", isActive('/settings') && "text-primary")} />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
