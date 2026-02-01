import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LocationSelector } from "@/components/LocationSelector";
import { UserMenu } from "@/components/UserMenu";
import { Building2 } from "lucide-react";
interface AppHeaderProps {
  title?: string;
  description?: string;
}
export function AppHeader({
  title,
  description
}: AppHeaderProps) {
  const {
    profile
  } = useAuth();
  const {
    data: organization
  } = useQuery({
    queryKey: ['organization', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const {
        data,
        error
      } = await supabase.from('organizations').select('id, name, slug').eq('id', profile.organization_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id
  });
  return <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-6" />
        
        {/* Organization Name */}
        {organization}

        {title && <>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </>}
      </div>

      <div className="flex items-center gap-4">
        <LocationSelector />
        <UserMenu />
      </div>
    </header>;
}