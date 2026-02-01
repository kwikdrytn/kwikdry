import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LocationSelector } from "@/components/LocationSelector";
import { UserMenu } from "@/components/UserMenu";
interface AppHeaderProps {
  title?: string;
}
export function AppHeader({ title }: AppHeaderProps) {
  return <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-6" />
        
        {title && <>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <h1 className="hidden lg:block text-lg font-semibold">{title}</h1>
          </>}
      </div>

      <div className="flex items-center gap-4">
        <LocationSelector />
        <UserMenu />
      </div>
    </header>;
}