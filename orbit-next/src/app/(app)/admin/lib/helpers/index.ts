export function getIsoWeekLabel(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatIsoWeekLabel(isoWeek: string): string {
  const [yearPart, weekPart] = isoWeek.split('-W');
  if (!yearPart || !weekPart) return isoWeek;
  return `W${weekPart} ${yearPart}`;
}

export function formatDateTime(value: any) {
  if (!value) return '';
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}

export function formatTime(value: any) {
  if (!value) return '';
  try { return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); } catch { return String(value); }
}

export function getTimestamp(value: any) {
  try { const ts = new Date(value).getTime(); return Number.isNaN(ts) ? 0 : ts; } catch { return 0; }
}

export function formatDate(value: any) {
  if (!value) return '';
  try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
}

export const WEEKDAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const safeJsonParse = (input: unknown) => {
  if (input === null || input === undefined) return null;
  try {
    let text = typeof input === 'string' ? input : String(input);
    text = text.trim();
    if (!text || text === 'undefined' || text === 'null') return null;
    try { return JSON.parse(text); } catch { return JSON.parse(text.replace(/'/g, '"')); }
  } catch { return null; }
};

export function getDateRange(start: string, end: string) {
  const result: string[] = [];
  try {
    let current = new Date(start);
    const last = new Date(end);
    while (current <= last) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
  } catch {}
  return result;
}

export function formatAlertMessage(
  message: string | null,
  resolveUserEmailById?: (id: string) => string | undefined | null
): string {
  if (!message) return '';
  let raw = String(message).trim();
  try {
    const equipmentMarker = raw.toLowerCase().indexOf('[equipment:');
    const jsonStart = equipmentMarker === -1 ? -1 : raw.indexOf('{', equipmentMarker);
    if (jsonStart !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let jsonEnd = -1;
      for (let i = jsonStart; i < raw.length; i++) {
        const char = raw[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === '{') depth++;
        else if (char === '}' && --depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }

      if (jsonEnd !== -1) {
        const equipmentData = safeJsonParse(raw.slice(jsonStart, jsonEnd));
        if (equipmentData && typeof equipmentData === 'object' && !Array.isArray(equipmentData)) {
          const items = Array.isArray(equipmentData.items)
            ? equipmentData.items
                .map((item: unknown) => {
                  const name = typeof item === 'string'
                    ? item
                    : item && typeof item === 'object' && 'name' in item && typeof item.name === 'string'
                      ? item.name
                      : '';
                  return name.trim().replace(/_/g, ' ');
                })
                .filter(Boolean)
            : [];
          const others = typeof equipmentData.others === 'string' ? equipmentData.others.trim() : '';
          const readableEquipment = [
            items.length ? `Equipment: ${items.join(', ')}` : '',
            others ? `Additional notes: ${others}` : '',
          ].filter(Boolean).join('; ');
          const markerEnd = raw.indexOf(']', jsonEnd);
          const end = markerEnd === -1 ? jsonEnd : markerEnd + 1;
          raw = `${raw.slice(0, equipmentMarker)}${readableEquipment}${raw.slice(end)}`;
        }
      }
    }
  } catch {}
  try {
    const uuidRegex = /Session ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
    if (uuidRegex.test(raw) || raw.includes('The computer session for this user was automatically logged out due to inactivity')) {
      return raw.replace('this user', 'a user');
    }
  } catch {}
  try {
    const unbanMatch = raw.match(/User ([0-9a-f-]{36}) has been unbanned/);
    if (unbanMatch && resolveUserEmailById) {
      const userEmail = resolveUserEmailById(unbanMatch[1]) || '';
      if (userEmail) return raw.replace(unbanMatch[1], userEmail);
    }
  } catch {}
  try {
    const needsMatch = raw.match(/Needs:\s*(\{[\s\S]*\})/i);
    const eqMatch = raw.match(/Requested equipment:\s*([^\[]+)/i);
    const mapToken = (tok: string) => {
      const t = String(tok || '').replace(/_/g, ' ').trim();
      const lower = t.toLowerCase();
      if (lower.includes('others')) return null;
      if (lower.includes('whiteboard')) return 'Whiteboard & Markers';
      if (lower.includes('projector')) return 'Projector';
      if (lower.includes('extension cord') || lower.includes('extension_cord')) return 'Extension Cord';
      if (lower.includes('hdmi')) return 'HDMI Cable';
      if (lower.includes('extra chairs') || lower.includes('extra_chairs')) return 'Extra Chairs';
      return t.replace(/[.,;]+$/g, '').trim();
    };
    let equipmentList: string[] = [];
    let othersText: string | null = null;
    if (needsMatch && needsMatch[1]) {
      try {
        const obj = safeJsonParse(needsMatch[1]) || {};
        const items = Array.isArray((obj as any).items) ? (obj as any).items : [];
        let othersFromItems = '';
        equipmentList = items.map((it: string) => {
          const t = String(it || '').trim();
            if (/others?/i.test(t)) {
              const trailing = t.replace(/.*?others[:\s-]*/i, '').trim();
              if (trailing && !othersFromItems) othersFromItems = trailing;
              return null;
            }
            return mapToken(t);
          }).filter(Boolean) as string[];
        othersText = othersFromItems || ((obj as any).others ? String((obj as any).others).trim() : null);
      } catch {}
    } else if (eqMatch && eqMatch[1]) {
      const parts = eqMatch[1].split(/[;,]+/).map(s => String(s).trim()).filter(Boolean);
      let othersFromParts = '';
      equipmentList = parts.map(p => {
        if (/others?/i.test(p)) {
          const trailing = p.replace(/.*?others[:\s-]*/i, '').trim();
          if (trailing && !othersFromParts) othersFromParts = trailing;
          return null;
        }
        return mapToken(p);
      }).filter(Boolean) as string[];
      const extrasMatch = eqMatch[1].match(/Others?:\s*(.*)$/i);
      othersText = othersFromParts || (extrasMatch && extrasMatch[1] ? String(extrasMatch[1]).trim() : null);
    }
    if ((equipmentList && equipmentList.length > 0) || othersText) {
      const items = equipmentList.slice();
      if (othersText && !items.includes('and others')) items.push('and others');
      const itemsText = items.join(', ').replace(/,\s*and others/i, ' and others');
      const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const prefix = emailMatch ? `${emailMatch[1]} ` : '';
      return `${prefix}Requested equipment: ${itemsText}`;
    }
  } catch {}
  try {
    let cleaned = raw
      .replace(/\(Session ID: [0-9a-f-]+\)/g, '')
      .replace(/\(ID: [0-9a-f-]+\)/g, '')
      .replace(/\(ID removed\)/g, '')
      .trim();
    const uuidRegexGlobal = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
    if (resolveUserEmailById) {
      cleaned = cleaned.replace(uuidRegexGlobal, (m) => {
        const found = resolveUserEmailById(m) || '';
        return found ? found : '';
      });
    }
    cleaned = cleaned.replace(/booking\s+[0-9a-f-]{36}/gi, 'booking');
    return cleaned.replace(/\s{2,}/g, ' ').trim();
  } catch { return raw; }
}
