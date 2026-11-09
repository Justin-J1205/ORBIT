import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/ui";
import type { FacilityBooking } from "@shared/schema";

export function useBookingMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const adminBookingActionMutation = useMutation({
    mutationFn: async ({ bookingId, ...action }: { bookingId: string; action: string; reason?: string; startTime?: string; endTime?: string; facilityId?: number; participants?: number; purpose?: string; name?: string; program?: string }) => {
      const res = await apiRequest("POST", `/api/admin/bookings/${bookingId}/actions`, action);
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bookings/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] }),
      ]);
      toast({ title: "Booking updated", description: "The booking action was recorded and the requester was notified." });
    },
    onError: (error: Error) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const confirmArrivalMutation = useMutation({
    mutationFn: async ({ bookingId }: any) => {
      const res = await apiRequest('POST', `/api/bookings/${bookingId}/confirm-arrival`);
      return res.json?.();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] }),
      ]);
    },
  });

  const forceActiveBookingMutation = useMutation<any, Error, FacilityBooking>({
    mutationFn: async (booking: FacilityBooking) => {
      const now = new Date();
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const res = await apiRequest("POST", `/api/admin/bookings/${booking.id}/actions`, {
        action: "force_active",
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
      });
      return res.json?.();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings/pending'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings/all'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] }),
      ]);
      setTimeout(async () => {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['/api/admin/bookings'] }),
          queryClient.refetchQueries({ queryKey: ['/api/bookings/pending'] }),
        ]);
      }, 500);
      toast({ 
        title: 'Booking Activated', 
        description: 'Booking has been forced to active status for testing.',
        variant: 'default' 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error?.message || 'Failed to force booking active',
        variant: 'destructive' 
      });
    },
  });

  const handleApproveNoop = (_bookingId: any) => {
    try {
      toast({ 
        title: 'Auto-scheduled', 
        description: 'Bookings are scheduled automatically; manual approval has been removed.', 
        variant: 'default' 
      });
    } catch (e) {}
    queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings/pending'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/alerts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/activity'] });
  };

  const handleDenyNoop = (_bookingId: any) => {
    try {
      toast({ 
        title: 'Action removed', 
        description: 'Manual denial has been removed. The system handles scheduling automatically.', 
        variant: 'default' 
      });
    } catch (e) {}
    queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/bookings/pending'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/alerts'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/activity'] });
  };

  return {
    adminBookingActionMutation,
    confirmArrivalMutation,
    forceActiveBookingMutation,
  };
}
