"use client";

import React, { useState, useEffect } from 'react';
import { FacilityBooking } from '@shared/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';

interface CheckEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: FacilityBooking | null;
  onSaveEquipmentStatuses?: (booking: FacilityBooking, statuses: Record<string, 'prepared' | 'not_available' | 'pending'>) => Promise<void>;
  onMarkAsPrepared?: (booking: FacilityBooking) => void;
  onMarkAsNotAvailable?: (booking: FacilityBooking) => void;
}

export function CheckEquipmentModal({
  isOpen,
  onClose,
  booking,
  onSaveEquipmentStatuses,
  onMarkAsPrepared,
  onMarkAsNotAvailable,
}: CheckEquipmentModalProps) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'prepared' | 'not_available' | 'pending'>>({});
  const [isSaving, setIsSaving] = useState(false);

  const getEquipmentItems = () => {
    if (!booking?.equipment) return [];
    
    try {
      const equipment = booking.equipment;
      const items: { label: string; isOther: boolean }[] = [];
      
      if (typeof equipment === 'object' && equipment !== null) {
        if (Array.isArray((equipment as any).items)) {
          (equipment as any).items.forEach((item: string) => {
            const displayKey = item
              .split("_")
              .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
              .join(" ");
            items.push({ label: displayKey, isOther: false });
          });
        } else {
          Object.entries(equipment).forEach(([key, value]) => {
            if (key === 'others') {
              // Skip 'others' here, will add it at the end
            } else if (value === true || value === 'prepared' || value === 'requested') {
              const displayKey = key
                .split("_")
                .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
                .join(" ");
              items.push({ label: displayKey, isOther: false });
            }
          });
        }
        
        if ((equipment as any).others) {
          items.push({ label: String((equipment as any).others), isOther: true });
        }
      }
      
      return items;
    } catch (e) {
      return [];
    }
  };

  const equipmentItems = getEquipmentItems();

  // Initialize item statuses when modal opens
  useEffect(() => {
    if (isOpen && equipmentItems.length > 0) {
      const initialStatuses: Record<string, 'prepared' | 'not_available' | 'pending'> = {};
      equipmentItems.forEach(item => {
        initialStatuses[item.label] = 'pending';
      });
      setItemStatuses(initialStatuses);
    }
  }, [isOpen, booking?.id]);

  const toggleItemStatus = (itemLabel: string, status: 'prepared' | 'not_available') => {
    setItemStatuses(prev => ({
      ...prev,
      [itemLabel]: prev[itemLabel] === status ? 'pending' : status
    }));
  };

  const getItemStatusColor = (status: 'prepared' | 'not_available' | 'pending') => {
    switch (status) {
      case 'prepared':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'not_available':
        return 'bg-red-50 text-red-700 border-red-300';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';
    }
  };

  const allPrepared = Object.values(itemStatuses).every(status => status === 'prepared');
  const allNotAvailable = Object.values(itemStatuses).every(status => status === 'not_available');
  const hasChanges = Object.values(itemStatuses).some(status => status !== 'pending');

  const handleSave = async () => {
    if (!booking || !hasChanges || isSaving) return;
    
    console.log('CheckEquipmentModal - handleSave called', {
      bookingId: booking.id,
      itemStatuses,
      hasChanges
    });
    
    setIsSaving(true);
    try {
      // If custom save handler exists, use it
      if (onSaveEquipmentStatuses) {
        console.log('Calling onSaveEquipmentStatuses...');
        await onSaveEquipmentStatuses(booking, itemStatuses);
        console.log('onSaveEquipmentStatuses completed successfully');
      } else {
        console.log('No onSaveEquipmentStatuses handler, using fallback');
        // Fallback: determine overall status and use old handlers
        const allItemsPrepared = Object.values(itemStatuses).every(s => s === 'prepared');
        if (allItemsPrepared && onMarkAsPrepared) {
          await onMarkAsPrepared(booking);
        } else if (onMarkAsNotAvailable) {
          await onMarkAsNotAvailable(booking);
        }
      }
      // Close modal after successful save
      console.log('Save successful, closing modal');
      onClose();
    } catch (error) {
      console.error('Error saving equipment statuses:', error);
      alert(`Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl mx-2">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Check Equipment & Needs</DialogTitle>
          <DialogDescription>
            Review and update the status of equipment and needs for this booking
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Booking Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Booking ID:</span>
                <p className="font-medium text-gray-900 text-xs break-all">{booking.id}</p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <Badge className="ml-2 bg-pink-100 text-pink-800">{booking.status}</Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Equipment & Needs Checklist</h3>
            {equipmentItems.length > 0 ? (
              <div className="space-y-2">
                {equipmentItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 p-3 bg-white border border-gray-200 rounded-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {item.isOther && <span className="text-lg">📦</span>}
                      <span className="break-words text-sm font-medium text-gray-900">{item.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`${getItemStatusColor(itemStatuses[item.label] || 'pending')} min-w-[100px] justify-center`}
                      >
                        {itemStatuses[item.label] === 'prepared' && '✅ Prepared'}
                        {itemStatuses[item.label] === 'not_available' && '❌ Not Available'}
                        {itemStatuses[item.label] === 'pending' && 'Pending'}
                      </Badge>
                      
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleItemStatus(item.label, 'prepared')}
                          className={`min-h-[44px] min-w-[44px] p-0 ${
                            itemStatuses[item.label] === 'prepared' 
                              ? 'bg-green-100 border-green-500 text-green-700' 
                              : 'hover:bg-green-50'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleItemStatus(item.label, 'not_available')}
                          className={`min-h-[44px] min-w-[44px] p-0 ${
                            itemStatuses[item.label] === 'not_available' 
                              ? 'bg-red-100 border-red-500 text-red-700' 
                              : 'hover:bg-red-50'
                          }`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No equipment or needs requested</p>
            )}
          </div>

          <Separator />

          <div className="flex items-center gap-3 justify-between bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">
              {hasChanges ? (
                <span className="font-medium">
                  {Object.values(itemStatuses).filter(s => s === 'prepared').length} prepared, {' '}
                  {Object.values(itemStatuses).filter(s => s === 'not_available').length} not available, {' '}
                  {Object.values(itemStatuses).filter(s => s === 'pending').length} pending
                </span>
              ) : (
                <span>Mark each item using the checkmark (✓) or X buttons above</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="min-h-[44px]"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>💾 Save Changes</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
