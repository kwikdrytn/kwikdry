import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationFormDialog } from "@/components/locations/LocationFormDialog";
import { DeactivateLocationDialog } from "@/components/locations/DeactivateLocationDialog";
import {
  useLocationsWithTeamCount,
  useCreateLocation,
  useUpdateLocation,
  useDeactivateLocation,
  LocationWithTeamCount,
  LocationFormData,
  TIMEZONES,
} from "@/hooks/useLocations";
import { Plus, MapPin, Users, Clock, Edit, Trash2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function LocationManagement() {
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithTeamCount | null>(null);

  const { data: locations, isLoading } = useLocationsWithTeamCount();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deactivateLocation = useDeactivateLocation();

  const handleAddClick = () => {
    setSelectedLocation(null);
    setFormDialogOpen(true);
  };

  const handleEditClick = (location: LocationWithTeamCount) => {
    setSelectedLocation(location);
    setFormDialogOpen(true);
  };

  const handleDeactivateClick = (location: LocationWithTeamCount) => {
    setSelectedLocation(location);
    setDeactivateDialogOpen(true);
  };

  const handleFormSubmit = async (data: LocationFormData) => {
    if (selectedLocation) {
      await updateLocation.mutateAsync({ id: selectedLocation.id, data });
    } else {
      await createLocation.mutateAsync(data);
    }
    setFormDialogOpen(false);
    setSelectedLocation(null);
  };

  const handleDeactivateConfirm = async () => {
    if (selectedLocation) {
      await deactivateLocation.mutateAsync(selectedLocation.id);
      setDeactivateDialogOpen(false);
      setSelectedLocation(null);
    }
  };

  const getTimezoneLabel = (tz: string | null) => {
    if (!tz) return "Not set";
    const found = TIMEZONES.find((t) => t.value === tz);
    return found?.label || tz;
  };

  const formatAddress = (location: LocationWithTeamCount) => {
    const parts = [
      location.address,
      location.city,
      location.state,
      location.zip,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <DashboardLayout title="Locations">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Locations</h2>
            <p className="text-muted-foreground">
              Manage locations and their team assignments
            </p>
          </div>
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>

        {/* Location Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : locations?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">No locations yet</p>
              <p className="text-muted-foreground mb-4">
                Add your first location to get started.
              </p>
              <Button onClick={handleAddClick}>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations?.map((location) => {
              const address = formatAddress(location);
              
              return (
                <Card key={location.id} className="relative overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{location.name}</CardTitle>
                          {address && (
                            <CardDescription className="line-clamp-1">
                              {address}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={location.is_active ? "default" : "secondary"}
                        className={location.is_active ? "bg-success text-success-foreground" : ""}
                      >
                        {location.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          <strong>{location.team_count}</strong> team member{location.team_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{getTimezoneLabel(location.timezone)}</span>
                      </div>
                    </div>

                    {location.phone && (
                      <p className="text-sm text-muted-foreground">{location.phone}</p>
                    )}

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEditClick(location)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => handleDeactivateClick(location)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deactivate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <LocationFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        location={selectedLocation}
        onSubmit={handleFormSubmit}
        isSubmitting={createLocation.isPending || updateLocation.isPending}
      />

      <DeactivateLocationDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        location={selectedLocation}
        onConfirm={handleDeactivateConfirm}
        isDeactivating={deactivateLocation.isPending}
      />
    </DashboardLayout>
  );
}
