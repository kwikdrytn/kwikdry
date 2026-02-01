import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Settings, ChevronDown, Download, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function UserMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, install, dismiss } = usePWAInstall();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  };

  const getFullName = (firstName?: string | null, lastName?: string | null) => {
    return [firstName, lastName].filter(Boolean).join(' ') || 'User';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleInstall = async () => {
    await install();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium">
              {getFullName(profile?.first_name, profile?.last_name)}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {profile?.role?.replace('_', ' ')}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover border shadow-md z-50">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{getFullName(profile?.first_name, profile?.last_name)}</span>
            <span className="text-xs font-normal text-muted-foreground">{profile?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isInstallable && (
          <>
            <DropdownMenuItem 
              onClick={handleInstall}
              className="cursor-pointer"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Install App
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem 
          onClick={() => navigate('/settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
