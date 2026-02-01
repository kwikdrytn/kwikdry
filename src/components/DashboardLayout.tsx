import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  fullHeight?: boolean;
}

export function DashboardLayout({ children, title, fullHeight }: DashboardLayoutProps) {
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
