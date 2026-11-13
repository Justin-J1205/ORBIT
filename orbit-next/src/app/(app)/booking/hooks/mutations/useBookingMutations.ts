import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

/**
 * Hook for cancelling bookings
 */
export function useCancelBooking(toast: any) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest("POST", `/api/bookings/${bookingId}/cancel`, {
        reason: "User cancelled their own booking",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] }),
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "An error occurred while cancelling your booking.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for marking notifications as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/notifications/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });
}
