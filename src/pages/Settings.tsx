import { useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { Users, MapPin, Plug, ChevronRight, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvatarCropDialog } from "@/components/settings/AvatarCropDialog";

export default function Settings() {
  const { profile, signOut, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>("");

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  };

  const getFullName = (firstName?: string | null, lastName?: string | null) => {
    return [firstName, lastName].filter(Boolean).join(' ') || 'User';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setSelectedImageSrc(imageUrl);
    setCropDialogOpen(true);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!profile) return;

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filePath = `${user.id}/avatar.jpg`;

      // Upload cropped image to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL (add cache buster)
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Refresh profile to show new avatar
      await refreshProfile?.();
      toast.success('Profile picture updated');
      setCropDialogOpen(false);
      
      // Clean up object URL
      URL.revokeObjectURL(selectedImageSrc);
      setSelectedImageSrc("");
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropDialogClose = (open: boolean) => {
    if (!open && !isUploading) {
      setCropDialogOpen(false);
      URL.revokeObjectURL(selectedImageSrc);
      setSelectedImageSrc("");
    }
  };

  const adminLinks = [
    { title: "Users", description: "Manage team members and permissions", icon: Users, url: "/users" },
    { title: "Locations", description: "Manage business locations", icon: MapPin, url: "/locations" },
    { title: "Integrations", description: "Connect external services", icon: Plug, url: "/settings/integrations" },
  ];

  const isAdmin = profile?.role === 'admin';

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your personal information and account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar 
                  className="h-20 w-20 cursor-pointer transition-opacity group-hover:opacity-80"
                  onClick={handleAvatarClick}
                >
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </div>
              <div>
                <h3 className="font-medium">{getFullName(profile?.first_name, profile?.last_name)}</h3>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  Role: {profile?.role?.replace('_', ' ') ?? 'N/A'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue={getFullName(profile?.first_name, profile?.last_name)} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={profile?.email ?? ''} disabled />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Profile editing is not available in demo mode.
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Administration</CardTitle>
              <CardDescription>Manage your organization settings</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {adminLinks.map((link) => (
                  <Link
                    key={link.url}
                    to={link.url}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <link.icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{link.title}</p>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
            <CardDescription>Manage your session and account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={handleCropDialogClose}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
        isUploading={isUploading}
      />
    </DashboardLayout>
  );
}
