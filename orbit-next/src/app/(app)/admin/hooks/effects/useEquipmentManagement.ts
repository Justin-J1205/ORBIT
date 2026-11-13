import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/ui";
import { parseEquipmentItemsFromBooking, safeJsonParse } from "@admin";

export function useEquipmentManagement(
  allBookings: any[],
  getFacilityName: (id: string) => string | null,
  formatDateTime: (date: string | Date) => string
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [updatingNeedsIds, setUpdatingNeedsIds] = useState<Set<string>>(new Set());
  const [needsStatusById, setNeedsStatusById] = useState<Record<string, 'prepared' | 'not_available'>>({});
  const [bookingItemStatus, setBookingItemStatus] = useState<Record<string, Record<string, 'prepared' | 'not_available'>>>({});

  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [equipmentModalBooking, setEquipmentModalBooking] = useState<null | any>(null);
  const [equipmentModalItemStatuses, setEquipmentModalItemStatuses] = useState<Record<string, 'prepared' | 'not_available' | undefined>>({});
  const [isConfirmingEquipment, setIsConfirmingEquipment] = useState(false);

  const updateNeedsMutation = useMutation({
    mutationFn: async ({ bookingId, status, note }: { bookingId: string; status: 'prepared' | 'not_available'; note?: string }) => {
      const res = await apiRequest('POST', `/api/admin/bookings/${bookingId}/needs`, { status, note });
      return res.json();
    },
    onSuccess: async (_data, variables: any) => {
      try {
        const currentAlerts: any[] = queryClient.getQueryData(['/api/admin/alerts']) || [];
        const tempAlert = {
          id: `temp-${Date.now()}`,
          type: 'booking',
          message: `Equipment needs updated for booking`,
          details: variables.note || '',
          isRead: false,
          createdAt: new Date().toISOString(),
          bookingId: variables.bookingId,
        };
        queryClient.setQueryData(['/api/admin/alerts'], [tempAlert, ...currentAlerts]);
      } catch (e) {}

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/admin/bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/admin/activity'] }),
      ]);
    },
    onError: (err: any) => {
      try {
        toast({ title: 'Update failed', description: err?.message || String(err), variant: 'destructive' });
      } catch (e) {}
    }
  });

  const equipmentRequestDecisionMutation = useMutation({
    mutationFn: async ({ bookingId, itemKey, status, reason }: {
      bookingId: string;
      itemKey: string;
      status: "approved" | "declined";
      reason?: string;
    }): Promise<{ success: boolean; itemStatus: "approved" | "declined"; equipmentRequestStatus: string }> => {
      const res = await apiRequest("POST", `/api/admin/bookings/${bookingId}/equipment-decision`, {
        itemKey,
        status,
        reason,
      });
      return res.json();
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/admin/bookings"] }),
        queryClient.refetchQueries({ queryKey: ["/api/bookings"] }),
      ]);
      toast({
        title: variables.status === "approved" ? "Equipment item approved." : "Equipment item declined.",
        description: "The equipment approval status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Equipment decision failed", description: error.message, variant: "destructive" });
    },
  });

  const markBookingNeeds = useCallback(async (bookingId: string, status: 'prepared' | 'not_available', note?: string) => {
    try {
      setUpdatingNeedsIds(prev => new Set(prev).add(bookingId));
      await updateNeedsMutation.mutateAsync({ bookingId, status, note });
      setNeedsStatusById(prev => ({ ...prev, [bookingId]: status }));
      try {
        const bookingObj = (allBookings || []).find((b: any) => String(b.id) === String(bookingId));
        const bookingLabel = bookingObj ? `${getFacilityName(bookingObj.facilityId)} (${formatDateTime(bookingObj.startTime)})` : 'booking';
        const statusLabelMap: Record<string, string> = {
          prepared: 'Prepared',
          not_available: 'Not available',
          'not-available': 'Not available',
          'not available': 'Not available'
        };
        const statusLabel = statusLabelMap[String(status)] || String(status);
        toast({ title: 'Updated', description: `Marked needs as ${statusLabel} for ${bookingLabel}`, variant: 'default' });
      } catch (e) {
        toast({ title: 'Updated', description: `Marked needs as ${status} for booking`, variant: 'default' });
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUpdatingNeedsIds(prev => {
        const copy = new Set(prev);
        copy.delete(bookingId);
        return copy;
      });
    }
  }, [allBookings, getFacilityName, formatDateTime, updateNeedsMutation, toast]);

  const openEquipmentModal = useCallback((booking: any) => {
    try {
      if (showEquipmentModal && equipmentModalBooking && String(equipmentModalBooking.id) === String(booking?.id)) {
        return;
      }
      const items = parseEquipmentItemsFromBooking(booking);
      const existing = bookingItemStatus[String(booking.id)] || {};
      const initStatuses: Record<string, 'prepared' | 'not_available' | undefined> = {};
      items.forEach(it => { initStatuses[it] = existing[it]; });

      try {
        const resp = String(booking?.adminResponse || '');
        const m1 = resp.match(/Needs:\s*(\{[\s\S]*\})/i);
        const m2 = resp.match(/[—\-]\s*(\{[\s\S]*\})\s*$/);
        const jsonTxt = (m1 && m1[1]) ? m1[1] : (m2 && m2[1]) ? m2[1] : null;
        if (jsonTxt) {
          const parsed: any = safeJsonParse(jsonTxt);
          if (parsed && parsed.items && typeof parsed.items === 'object') {
            if (!Array.isArray(parsed.items)) {
              for (const [k, v] of Object.entries(parsed.items)) {
                const matchingItem = items.find(item => 
                  item.toLowerCase() === String(k).toLowerCase() || 
                  item.replace(/_/g, ' ').toLowerCase() === String(k).replace(/_/g, ' ').toLowerCase()
                );
                if (matchingItem) {
                  const val = (String(v).toLowerCase().includes('prepared')) ? 'prepared' : (String(v).toLowerCase().includes('not') ? 'not_available' : undefined);
                  if (val) initStatuses[matchingItem] = val;
                }
              }
            }
          }
        }
      } catch (e) {
        try { if (process.env.NODE_ENV === 'development') console.debug('[openEquipmentModal] parse error', e, booking?.adminResponse); } catch (_) {}
      }
      setEquipmentModalItemStatuses(initStatuses);
      setEquipmentModalBooking(booking);
      setShowEquipmentModal(true);
    } catch (e) {
      setEquipmentModalItemStatuses({});
      setShowEquipmentModal(false);
      setEquipmentModalBooking(null);
    }
  }, [showEquipmentModal, equipmentModalBooking, bookingItemStatus]);

  const confirmEquipmentModal = useCallback(async () => {
    if (!equipmentModalBooking || isConfirmingEquipment) return;
    setIsConfirmingEquipment(true);
    const bookingId = String(equipmentModalBooking.id);
    const statuses = { ...equipmentModalItemStatuses };
    const allPrepared = Object.values(statuses).length > 0 && Object.values(statuses).every(v => v === 'prepared');
    const overall: 'prepared' | 'not_available' = allPrepared ? 'prepared' : 'not_available';
    setBookingItemStatus(prev => ({ ...prev, [bookingId]: Object.entries(statuses).reduce((acc, [k, v]) => { if (v) acc[k] = v; return acc; }, {} as Record<string, 'prepared'|'not_available'>) }));
    setNeedsStatusById(prev => ({ ...prev, [bookingId]: overall }));
    const userEmail = equipmentModalBooking?.user?.email || 'user';
    try {
      await updateNeedsMutation.mutateAsync({ bookingId, status: overall, note: JSON.stringify({ items: statuses }) });
      try { toast({ title: 'Equipment Updated', description: `You updated ${userEmail}'s equipment request`, variant: 'default' }); } catch (e) {}
      setShowEquipmentModal(false);
      setEquipmentModalBooking(null);
      setEquipmentModalItemStatuses({});
    } catch (e: any) {
      try { toast({ title: 'Save failed', description: e?.message || String(e), variant: 'destructive' }); } catch (e) {}
    } finally {
      setIsConfirmingEquipment(false);
    }
  }, [equipmentModalBooking, isConfirmingEquipment, equipmentModalItemStatuses, updateNeedsMutation, toast]);

  const getNeedsStatusForBooking = useCallback((booking: any): 'prepared' | 'not_available' | undefined => {
    if (!booking) return undefined;
    if (needsStatusById[booking.id]) return needsStatusById[booking.id];
    try {
      const resp = String(booking?.adminResponse || '');
      const m = resp.match(/Needs:\s*(Prepared|Not Available)/i);
      if (m) return /prepared/i.test(m[1]) ? 'prepared' : 'not_available';
    } catch (e) {
      return undefined;
    }
    return undefined;
  }, [needsStatusById]);

  return {
    updatingNeedsIds,
    needsStatusById,
    setNeedsStatusById,
    bookingItemStatus,
    setBookingItemStatus,
    showEquipmentModal,
    setShowEquipmentModal,
    equipmentModalBooking,
    setEquipmentModalBooking,
    equipmentModalItemStatuses,
    setEquipmentModalItemStatuses,
    isConfirmingEquipment,
    markBookingNeeds,
    openEquipmentModal,
    confirmEquipmentModal,
    getNeedsStatusForBooking,
    updateNeedsMutation,
    equipmentRequestDecisionMutation,
  };
}
