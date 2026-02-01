import { LocationSelector } from "@/components/LocationSelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center justify-between gap-2 md:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {title && <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <LocationSelector />
        <Link to="/settings" className="hidden md:block">
          <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive h-8 w-8 md:h-10 md:w-10"
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>
    </header>
  );
}