import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

const SERVICE_TYPES = [
  "Carpet Cleaning",
  "Upholstery Cleaning",
  "Tile & Grout",
  "Water Damage",
  "Air Duct Cleaning",
  "Commercial Cleaning",
  "Other",
];

interface QuickBookingPopoverProps {
  callId: string;
  isBooked: boolean;
  currentServiceType: string | null;
  onToggle: (booked: boolean, serviceType?: string) => void;
}

export function QuickBookingPopover({
  callId,
  isBooked,
  currentServiceType,
  onToggle,
}: QuickBookingPopoverProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string>(currentServiceType || "");

  const updateMutation = useMutation({
    mutationFn: async ({ booked, serviceType }: { booked: boolean; serviceType?: string }) => {
      const { error } = await supabase
        .from("call_log")
        .update({
          resulted_in_booking: booked,
          booking_service_type: booked ? serviceType || null : null,
        })
        .eq("id", callId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-log"] });
      queryClient.invalidateQueries({ queryKey: ["call-metrics"] });
      setOpen(false);
      toast({
        title: isBooked ? "Booking removed" : "Marked as booked",
        description: isBooked 
          ? "Call is no longer marked as a booking" 
          : `Call marked as ${selectedService || "booked"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isBooked) {
      // If already booked, toggle off directly
      updateMutation.mutate({ booked: false });
    } else {
      // If not booked, open popover to select service type
      setOpen(true);
    }
  };

  const handleServiceSelect = (serviceType: string) => {
    setSelectedService(serviceType);
    updateMutation.mutate({ booked: true, serviceType });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleClick}
          disabled={updateMutation.isPending}
          className={cn(
            "h-5 w-5 rounded border inline-flex items-center justify-center transition-colors",
            isBooked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary hover:bg-muted/50"
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isBooked ? (
            <Check className="h-3 w-3" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-2" 
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Select Service Type</p>
          <Select onValueChange={handleServiceSelect} disabled={updateMutation.isPending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose service..." />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              updateMutation.mutate({ booked: true, serviceType: undefined });
            }}
            disabled={updateMutation.isPending}
          >
            Mark as booked without service type
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
