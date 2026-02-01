import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  fullHeight?: boolean;
}

export function DashboardLayout({ children, title, fullHeight }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  // Mobile layout with bottom navigation
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader title={title} />
        <main className={fullHeight ? "flex-1 pb-20" : "flex-1 p-4 pb-20"}>
          {children}
        </main>
        <BottomNav />
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <AppHeader title={title} />
          <main className={fullHeight ? "flex-1" : "flex-1 p-6"}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
