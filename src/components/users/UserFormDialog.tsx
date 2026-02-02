import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Sliders } from "lucide-react";
import { UserProfile, UserFormData, useLocations } from "@/hooks/useUsers";
import { useCustomRoles } from "@/hooks/useRoles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkillsPreferencesTab } from "./SkillsPreferencesTab";

const userFormSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(['admin', 'call_staff', 'technician']),
  custom_role_id: z.string().min(1, "Role is required"),
  location_id: z.string().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserProfile | null;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: UserFormDialogProps) {
  const { data: locations = [] } = useLocations();
  const { data: customRoles = [] } = useCustomRoles();
  const isEditing = !!user;
  const isTechnician = user?.role === 'technician';
  const [activeTab, setActiveTab] = useState("profile");

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'technician',
      custom_role_id: user?.custom_role_id ?? '',
      location_id: user?.location_id ?? null,
      address: user?.address ?? '',
      city: user?.city ?? '',
      state: user?.state ?? '',
      zip: user?.zip ?? '',
    },
  });

  // Reset form when user changes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setActiveTab("profile");
    }
    onOpenChange(open);
  };

  // Update form when user prop changes
  if (open && user) {
    const currentValues = form.getValues();
    if (currentValues.email !== user.email) {
      form.reset({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        role: user.role,
        custom_role_id: user.custom_role_id,
        location_id: user.location_id,
        address: user.address ?? '',
        city: user.city ?? '',
        state: user.state ?? '',
        zip: user.zip ?? '',
      });
    }
  }

  const handleSubmit = (data: UserFormData) => {
    onSubmit({
      ...data,
      phone: data.phone || '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${isEditing && isTechnician ? 'sm:max-w-[900px]' : 'sm:max-w-[500px]'} max-h-[90vh] bg-background flex flex-col overflow-hidden min-h-0`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditing ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the user details below.'
              : 'Fill in the details to create a new user.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && isTechnician ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2">
                <Sliders className="h-4 w-4" />
                Skills & Preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="flex-1 flex flex-col min-h-0 mt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col min-h-0 flex-1">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-4 pr-4">
                      <ProfileFormFields form={form} isEditing={isEditing} locations={locations} customRoles={customRoles} />
                    </div>
                  </ScrollArea>

                  <DialogFooter className="pt-4 mt-4 border-t flex-shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="skills" className="flex-1 flex flex-col min-h-0 mt-4">
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">
                  <SkillsPreferencesTab profileId={user.id} />
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 mt-4 border-t flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col min-h-0 flex-1">
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-4">
                  <ProfileFormFields form={form} isEditing={isEditing} locations={locations} customRoles={customRoles} />
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 mt-4 border-t flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Extracted profile form fields component
function ProfileFormFields({ 
  form, 
  isEditing, 
  locations, 
  customRoles 
}: { 
  form: any; 
  isEditing: boolean; 
  locations: any[]; 
  customRoles: any[]; 
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input placeholder="John" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input placeholder="Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input 
                type="email" 
                placeholder="john.doe@example.com" 
                {...field} 
                disabled={isEditing}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input 
                type="tel" 
                placeholder="(555) 123-4567" 
                {...field} 
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="custom_role_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value ?? ''}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-popover">
                {customRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="location_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value ?? undefined}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-popover">
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Address Section */}
      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Home Address (for route planning)</h4>
        
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input 
                  placeholder="123 Main Street" 
                  {...field} 
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-6 gap-3 mt-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="col-span-3">
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="City" 
                    {...field} 
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="col-span-1">
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="ST" 
                    maxLength={2}
                    {...field} 
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>ZIP</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="12345" 
                    {...field} 
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
