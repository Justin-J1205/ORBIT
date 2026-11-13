import { safeJsonParse } from '../helpers';

export type EquipmentApprovalStatus = 'pending' | 'approved' | 'declined';

export type EquipmentApprovalItem = {
  key: string;
  label: string;
  status: EquipmentApprovalStatus;
  declineReason?: string;
};

function getEquipmentLabel(item: string): string {
  const lower = item.toLowerCase().replace(/_/g, ' ');
  if (lower.includes('whiteboard')) return 'Whiteboard & Markers';
  if (lower.includes('projector')) return 'Projector';
  if (lower.includes('extension') && lower.includes('cord')) return 'Extension Cord';
  if (lower.includes('hdmi')) return 'HDMI Cable';
  if (lower.includes('extra') && lower.includes('chair')) return 'Extra Chairs';
  return item.replace(/_/g, ' ').replace(/[.,;]+$/g, '').trim();
}

export function getEquipmentApprovalItems(booking: {
  equipment?: unknown;
  equipmentRequestStatus?: string | null;
}): EquipmentApprovalItem[] {
  const equipment = typeof booking.equipment === 'string'
    ? safeJsonParse(booking.equipment)
    : booking.equipment;
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) return [];

  const equipmentRecord = equipment as Record<string, unknown>;
  const requestedItems = Array.isArray(equipmentRecord.items)
    ? equipmentRecord.items.map((item) => String(item ?? '').trim()).filter(Boolean)
    : Object.entries(equipmentRecord)
      .filter(([key, value]) => !['others', 'itemStatuses', 'itemDeclineReasons'].includes(key)
        && (value === true || value === 'requested' || value === 'prepared'))
      .map(([key]) => key);
  const itemStatuses = equipmentRecord.itemStatuses && typeof equipmentRecord.itemStatuses === 'object'
    ? equipmentRecord.itemStatuses as Record<string, unknown>
    : {};
  const itemDeclineReasons = equipmentRecord.itemDeclineReasons && typeof equipmentRecord.itemDeclineReasons === 'object'
    ? equipmentRecord.itemDeclineReasons as Record<string, unknown>
    : {};
  const overallStatus = booking.equipmentRequestStatus === 'denied'
    ? 'declined'
    : booking.equipmentRequestStatus;
  const items = requestedItems.map((key) => ({
    key,
    label: getEquipmentLabel(key),
  }));
  const others = typeof equipmentRecord.others === 'string' ? equipmentRecord.others.trim() : '';
  if (others) items.push({ key: 'others', label: `Others: ${others}` });

  return items.map(({ key, label }) => {
    const storedStatus = itemStatuses[key];
    const status: EquipmentApprovalStatus = storedStatus === 'approved' || storedStatus === 'declined'
      ? storedStatus
      : (overallStatus === 'approved' || overallStatus === 'declined') ? overallStatus : 'pending';
    const declineReason = itemDeclineReasons[key];
    return {
      key,
      label,
      status,
      ...(typeof declineReason === 'string' ? { declineReason } : {}),
    };
  });
}

export function getEquipmentRequestStatusLabel(status: string | null | undefined): string {
  if (!status || status === 'pending') return 'Pending';
  if (status === 'denied' || status === 'declined') return 'Declined';
  if (status === 'partially_approved') return 'Partially approved';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function parseEquipmentItemsFromBooking(booking: any): string[] {
  try {
    if (!booking || !booking.equipment) return [];
    let parsed: any = null;
    if (typeof booking.equipment === 'string') {
      parsed = safeJsonParse(booking.equipment);
    } else if (typeof booking.equipment === 'object') {
      parsed = booking.equipment;
    }
    if (!parsed) return [];
    const items = Array.isArray(parsed.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []);
    const cleanedItems: string[] = [];
    for (const item of items) {
      const itemStr = String(item || '').trim();
      if (!itemStr) continue;
      const lower = itemStr.toLowerCase().replace(/_/g, ' ');
      if (lower.includes('others')) continue;
      let friendly = itemStr;
      if (lower.includes('whiteboard')) friendly = 'Whiteboard & Markers';
      else if (lower.includes('projector')) friendly = 'Projector';
      else if (lower.includes('extension') && lower.includes('cord')) friendly = 'Extension Cord';
      else if (lower.includes('hdmi')) friendly = 'HDMI Cable';
      else if (lower.includes('extra') && lower.includes('chair')) friendly = 'Extra Chairs';
      else friendly = itemStr.replace(/_/g, ' ').replace(/[.,;]+$/g, '').trim();
      if (friendly && !cleanedItems.includes(friendly)) cleanedItems.push(friendly);
    }
    const others = parsed.others ? String(parsed.others).trim() : '';
    if (others && !cleanedItems.some(item => item.toLowerCase().includes('others'))) {
      cleanedItems.push(`Others: ${others}`);
    }
    return cleanedItems;
  } catch {
    return [];
  }
}
