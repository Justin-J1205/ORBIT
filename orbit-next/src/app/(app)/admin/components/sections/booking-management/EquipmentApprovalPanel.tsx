"use client";

import { useMemo, useState } from "react";
import type { FacilityBooking } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getEquipmentApprovalItems,
  getEquipmentRequestStatusLabel,
  type EquipmentApprovalStatus,
} from "@admin/lib/equipment";

type EquipmentDecisionInput = {
  bookingId: string;
  itemKey: string;
  status: Exclude<EquipmentApprovalStatus, "pending">;
  reason?: string;
};

type EquipmentDecisionResult = {
  success: boolean;
  itemStatus: Exclude<EquipmentApprovalStatus, "pending">;
  equipmentRequestStatus: string;
};

type EquipmentApprovalPanelProps = {
  booking: FacilityBooking;
  mutation: {
    mutateAsync: (input: EquipmentDecisionInput) => Promise<EquipmentDecisionResult>;
    isPending: boolean;
  };
};

function getStatusVariant(status: string) {
  if (status === "approved") return "default";
  if (status === "declined" || status === "denied") return "destructive";
  return "secondary";
}

export function EquipmentApprovalPanel({ booking, mutation }: EquipmentApprovalPanelProps) {
  const items = useMemo(() => getEquipmentApprovalItems(booking), [booking]);
  const [statuses, setStatuses] = useState<Record<string, EquipmentApprovalStatus>>(
    () => Object.fromEntries(items.map((item) => [item.key, item.status])),
  );
  const [declineReasonsByItem, setDeclineReasonsByItem] = useState<Record<string, string>>(
    () => Object.fromEntries(items.flatMap((item) => item.declineReason ? [[item.key, item.declineReason]] : [])),
  );
  const [overallStatus, setOverallStatus] = useState(booking.equipmentRequestStatus ?? "pending");
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState("");

  const decideItem = async (itemKey: string, status: Exclude<EquipmentApprovalStatus, "pending">) => {
    if (status === "declined" && declineReason.trim().length < 5) {
      setError("Enter a decline reason of at least 5 characters.");
      return;
    }

    setError("");
    try {
      const result = await mutation.mutateAsync({
        bookingId: booking.id,
        itemKey,
        status,
        reason: status === "declined" ? declineReason.trim() : undefined,
      });
      setStatuses((current) => ({ ...current, [itemKey]: result.itemStatus }));
      setOverallStatus(result.equipmentRequestStatus);
      if (status === "declined") {
        setDeclineReasonsByItem((current) => ({ ...current, [itemKey]: declineReason.trim() }));
      }
      setDeclineReason("");
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "The equipment decision could not be completed.");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Equipment borrowing request</h3>
        <Badge variant={getStatusVariant(overallStatus)}>
          {getEquipmentRequestStatusLabel(overallStatus)}
        </Badge>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const status = statuses[item.key] ?? item.status;
          return (
            <div key={item.key} className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-900">{item.label}</p>
                <Badge className="mt-1" variant={getStatusVariant(status)}>
                  {getEquipmentRequestStatusLabel(status)}
                </Badge>
                {(declineReasonsByItem[item.key] ?? item.declineReason) && status === "declined" && (
                  <p className="mt-1 break-words text-xs text-red-700">
                    {declineReasonsByItem[item.key] ?? item.declineReason}
                  </p>
                )}
              </div>
              {status === "pending" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  <Button
                    type="button"
                    className="min-h-[44px]"
                    disabled={mutation.isPending}
                    onClick={() => void decideItem(item.key, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-[44px]"
                    disabled={mutation.isPending || declineReason.trim().length < 5}
                    onClick={() => void decideItem(item.key, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.some((item) => (statuses[item.key] ?? item.status) === "pending") && (
        <Textarea
          value={declineReason}
          maxLength={1000}
          className="min-h-[44px]"
          onChange={(event) => setDeclineReason(event.target.value)}
          placeholder="Reason required to decline an item (at least 5 characters)."
        />
      )}
      {booking.equipmentDeclineReason && (
        <p className="break-words text-sm text-red-700">
          <strong>Decline reason:</strong> {booking.equipmentDeclineReason}
        </p>
      )}
      {error && <p role="alert" className="break-words text-sm text-red-600">{error}</p>}
    </div>
  );
}
