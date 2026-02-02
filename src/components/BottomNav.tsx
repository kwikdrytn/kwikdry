import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getNavItemsForRole } from "@/config/navigation";
import { Settings, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Define which items should appear in the main bottom nav (by URL)
const MAIN_NAV_URLS = ['/dashboard', '/inventory', '/checklists', '/training'];

export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Get all nav items for role
  const allNavItems = getNavItemsForRole(profile?.role ?? null).filter(
    item => item.url !== '/settings'
  );
  
  // Split into main nav items and overflow items
  const mainNavItems = allNavItems.filter(item => MAIN_NAV_URLS.includes(item.url));
  const overflowItems = allNavItems.filter(item => !MAIN_NAV_URLS.includes(item.url));

  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + '/');

  // Check if any overflow item is active
  const isOverflowActive = overflowItems.some(item => isActive(item.url)) || isActive('/settings');

  return (
    <>
      {/* Overlay for more menu */}
      {isMoreOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {/* Expanded more menu */}
      {isMoreOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-border bg-white px-4 py-3 safe-area-bottom animate-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-4 gap-2">
            {overflowItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg text-xs transition-colors",
                  isActive(item.url)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive(item.url) && "text-primary")} />
                <span className="truncate max-w-[64px]">{item.title}</span>
              </Link>
            ))}
            <Link
              to="/settings"
              onClick={() => setIsMoreOpen(false)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg text-xs transition-colors",
                isActive('/settings')
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <Settings className={cn("h-5 w-5", isActive('/settings') && "text-primary")} />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white safe-area-bottom">
        <div className="flex h-16 items-center justify-around px-2">
          {mainNavItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              onClick={() => setIsMoreOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                isActive(item.url)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive(item.url) && "text-primary")} />
              <span className="truncate max-w-[64px]">{item.title}</span>
            </Link>
          ))}
          
          {/* More button */}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
              isMoreOpen || isOverflowActive
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            {isMoreOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <MoreHorizontal className={cn("h-5 w-5", isOverflowActive && "text-primary")} />
            )}
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
