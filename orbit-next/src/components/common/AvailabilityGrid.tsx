import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/data';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils/utils';
import { CalendarDays, CheckCircle2, Filter, Slash, Undo2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isFacilityAllowedForRole } from '@shared/facilityAccess';

interface SlotItem {
  start: string;
  end: string;
  status: 'available' | 'scheduled' | 'unavailable';
  bookings?: Array<{ id: string; startTime: string; endTime: string; status: string; userId?: string }>
}

interface FacilityAvailability {
  facility: { id: number; name: string; capacity: number; isActive: boolean; allowedRoles?: string[] | null };
  maxUsageHours: number | null;
  slots: SlotItem[];
}

// Helper to format facility name for display
const formatFacilityName = (name: string) => {
  if (!name) return name;
  const lower = name.toLowerCase();
  // Ensure proper facility naming - add "Faculty" prefix if missing for Lounge
  if (lower === 'lounge' && !lower.includes('faculty')) {
    return 'Faculty Lounge';
  }
  return name;
};

export default function AvailabilityGrid({ date, onSelectRange, unavailableDatesByFacility }: { date?: Date; onSelectRange?: (facilityId: number, startIso: string, endIso: string) => void, unavailableDatesByFacility?: Record<string, string[]> }) {
  // --- Always call hooks at the top level ---
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = useState<number|null>(null);
  const [availabilityView, setAvailabilityView] = useState<'available' | 'unavailable' | 'all'>('available');
  const [slotPreview, setSlotPreview] = useState<{ facilityId: number; slots: SlotItem[] } | null>(null);
  const [showScheduled, setShowScheduled] = useState(true);
  // selectedDate is writable so users can toggle between days/months
  const [selectedDate, _setSelectedDate] = useState<Date>(() => {
    if (date) return date;
    const now = new Date();
    // If current time is 7:00 PM (19:00) or later, default to the next day
    const minutes = now.getHours() * 60 + now.getMinutes();
    const closeMinutes = 19 * 60; // 19:00
    if (minutes >= closeMinutes) {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(0, 0, 0, 0);
      return t;
    }
    // Otherwise default to today at local midnight
    const t = new Date(now);
    t.setHours(0, 0, 0, 0);
    return t;
  });
  // When date changes, reset selectedRoomId to force user to reselect and avoid white screen
  const setSelectedDate = (d: Date) => {
    _setSelectedDate(d);
    setSelectedRoomId(null);
  };
  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/availability', dateStr],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/availability?date=${dateStr}`);
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return (
    <div className="space-y-4 py-6">
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-16 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (error) return (
    <div className="py-6 text-sm text-red-600">
      Failed to load availability
      <div className="mt-2">
        <button onClick={() => refetch()} className="px-3 py-1 bg-pink-600 text-white rounded text-sm">Retry</button>
      </div>
    </div>
  );

  const facilities: FacilityAvailability[] = (data && data.data) || [];


  // --- Calendar grid setup ---
  // Weekdays: Mon-Sat, hours: 7:30-19:00 (Mon–Fri), 7:30-12:00 (Sat), hourly slots
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // 7:30, 8:30, ..., 18:30 (Mon–Fri), 7:30–11:30 (Sat)
  const hours = Array.from({ length: 12 }, (_, i) => 7.5 + i); // 7:30 to 18:30
  const satHours = Array.from({ length: 5 }, (_, i) => 7.5 + i); // 7:30 to 11:30
  const today = new Date();
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  // Helper: get date for each weekday in this week
  const getDateForDay = (d: number) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + d);
    return date;
  };

  // Helper: find slot for a facility, day, and hour (hourly slot)
  function findSlot(facility: FacilityAvailability, date: Date, hour: number) {
    // Find slot that matches this date and hour (hourly slot, start at :30)
    const slot = (facility.slots || []).find(s => {
      const slotStart = new Date(s.start);
      return slotStart.getFullYear() === date.getFullYear() &&
        slotStart.getMonth() === date.getMonth() &&
        slotStart.getDate() === date.getDate() &&
        slotStart.getHours() + slotStart.getMinutes() / 60 === hour;
    });
    return slot;
  }

  // --- Room list for sidebar (per role) ---
  const roomList = [
    { name: 'Collaborative Learning 1', match: /collaborative learning room 1/i },
    { name: 'Collaborative Learning 2', match: /collaborative learning room 2/i },
    { name: 'Board Room', match: /board room/i },
    { name: 'Faculty Lounge', match: /lounge|faculty lounge/i },
  ];
  // Map roomList to facility ids
  const roomMap = facilities.reduce((acc, f) => {
    const found = roomList.find(r => r.match.test(f.facility.name));
    if (found) acc[found.name] = f.facility.id;
    return acc;
  }, {} as Record<string, number>);
  const userRole = user?.role || 'student';
  const filteredRoomList = roomList.filter(room => {
    const facility = facilities.find(item => room.match.test(item.facility.name));
    return facility ? isFacilityAllowedForRole(facility.facility, userRole) : false;
  });

  // --- Sidebar mini calendar (interactive) ---
  const renderMiniCalendar = () => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    // Handlers for prev/next month
    const handlePrevMonth = () => {
  const prev = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  setSelectedDate(prev);
    };
    const handleNextMonth = () => {
  const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
  setSelectedDate(next);
    };

    // Handler for selecting a day
    const handleSelectDay = (d: number | null) => {
  if (!d) return;
  // Always set time to midnight and create a new Date instance for React state
  const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d, 0, 0, 0, 0);
  setSelectedDate(newDate);
    };

    return (
      <div className="bg-white rounded-lg p-2 md:p-3 shadow-sm mb-4 w-full max-w-xs mx-auto md:mx-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={handlePrevMonth} className="px-2 py-1 text-gray-500 hover:text-blue-600" aria-label="Previous month">&#8592;</button>
          <span className="font-semibold text-sm">{format(selectedDate, 'MMMM yyyy')}</span>
          <button onClick={handleNextMonth} className="px-2 py-1 text-gray-500 hover:text-blue-600" aria-label="Next month">&#8594;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-center text-gray-500 mb-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={d + i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const isSelected = d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return (
              <button
                key={i}
                className={`w-6 h-6 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-all duration-75
                  ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}
                  ${isToday && !isSelected ? 'border-2 border-blue-600 bg-blue-100 text-blue-900 font-bold shadow-lg' : ''}
                  ${isToday && isSelected ? 'ring-4 ring-blue-300 border-2 border-blue-700 bg-blue-700 text-white font-bold shadow-lg' : ''}
                `}
                style={{ outline: isSelected ? '2px solid #2563eb' : undefined }}
                onClick={() => handleSelectDay(d)}
                tabIndex={d ? 0 : -1}
                disabled={!d}
              >
                {d || ''}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Sidebar legend ---
  const renderLegend = () => (
    <div className="mt-6 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Availability</p>
        <div className="flex flex-wrap gap-2">
          {([
            { label: 'Available', value: 'available', badge: 'bg-emerald-500', description: 'Show open slots', icon: CheckCircle2 },
            { label: 'Unavailable', value: 'unavailable', badge: 'bg-red-500', description: 'Show closed slots', icon: Slash },
            { label: 'All', value: 'all', badge: 'bg-slate-400', description: 'Show everything', icon: Filter },
          ] as const).map(({ label, value, badge, icon: Icon, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => setAvailabilityView(value)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                availabilityView === value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
              )}
              aria-pressed={availabilityView === value}
            >
              <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', badge)} aria-hidden="true" />
              <span className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">{availabilityView === 'available' ? 'Showing only open time slots.' : availabilityView === 'unavailable' ? 'Showing only blocked slots or facility closures.' : 'Showing every slot including unavailable ones.'}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Overlay</p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={showScheduled} onChange={e => setShowScheduled(e.target.checked)} className="accent-yellow-400" />
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400" aria-hidden="true"></span>
          Show scheduled (pending/approved) bookings
        </label>
      </div>
      {slotPreview ? (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
            <span>Next available slots</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:border-blue-300"
              onClick={() => setSlotPreview(null)}
            >
              <Undo2 className="h-3 w-3" />
              Reset
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-blue-800">
            {slotPreview.slots.slice(0, 4).map((slot) => (
              <li key={`${slot.start}-${slot.end}`} className="flex items-center justify-between rounded-md bg-white px-2 py-1 shadow-sm">
                <span>{format(new Date(slot.start), 'EEE, MMM d')}</span>
                <span className="font-medium">
                  {format(new Date(slot.start), 'hh:mm a')} – {format(new Date(slot.end), 'hh:mm a')}
                </span>
              </li>
            ))}
            {slotPreview.slots.length === 0 ? (
              <li className="rounded-md bg-white px-2 py-1 text-[11px] text-blue-600">No open slots returned.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );

  // --- Main calendar grid, only for selected room ---
  const renderGrid = () => {
  const facility = facilities.find(f => f.facility.id === selectedRoomId);
  // Get unavailable dates for this facility (YYYY-MM-DD)
  const unavailableDates: string[] = unavailableDatesByFacility && facility ? (unavailableDatesByFacility[facility.facility.id] || []) : [];
    if (!facility) return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-base md:text-lg h-[200px] md:h-full min-h-[200px] md:min-h-[400px]">Select a room to view its schedule</div>
    );
    // If all school hours for the week are in the past, show only a single centered 'Unavailable' text
    const now = new Date();
    let allSchoolHoursPast = true;
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) { // Mon-Sat
      const date = getDateForDay(dayIdx);
      const isSat = dayIdx === 5;
      const dayHours = isSat ? satHours : hours;
      for (let h of dayHours) {
        const slotTime = new Date(date);
        slotTime.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
        const slotEnd = new Date(slotTime.getTime() + 60 * 60000);
        if (slotEnd > now) {
          allSchoolHoursPast = false;
          break;
        }
      }
      if (!allSchoolHoursPast) break;
    }
    if (allSchoolHoursPast) {
      return (
        <div className="flex-1 w-full overflow-x-auto flex items-center justify-center min-h-[200px] sm:min-h-[400px]">
          <span className="text-lg sm:text-2xl text-gray-500 font-semibold">Unavailable</span>
        </div>
      );
    }
    // Otherwise, show the normal grid
    return (
      <div className="flex-1 w-full overflow-x-auto">
        <div className="mb-4 md:mb-8">
          <div className="font-semibold text-base md:text-base mb-2 text-center md:text-left">{formatFacilityName(facility.facility.name)}</div>
          <div className="bg-white rounded-lg shadow-sm p-0">
            {/* Header: days of week */}
            <div className="grid grid-cols-6 border-b border-gray-200 text-xs md:text-xs" style={{ minWidth: 600 }}>
              {weekDays.map((d, i) => {
                const date = getDateForDay(i);
                return (
                  <div key={d} className="py-2 px-1 md:px-2 text-center font-semibold">
                    <span>{d}</span>
                    <div className="text-xs text-gray-500">{format(date, 'd')}</div>
                  </div>
                );
              })}
            </div>
            {/* Time grid */}
            <div className="relative">
              {/* Red timeline for current time removed */}
              <div className="grid grid-cols-6" style={{ minWidth: 600 }}>
                {weekDays.map((d, dayIdx) => {
                  const date = getDateForDay(dayIdx);
                  const isSat = dayIdx === 5;
                  const dayHours = isSat ? satHours : hours;
                  return (
                    <div key={d} className="border-r border-gray-200 last:border-r-0">
                      {dayHours.map((h, hIdx) => {
                        const slotTime = new Date(date);
                        slotTime.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
                        // Find the real slot for this facility, day, and time
                        const slot = findSlot(facility, date, h);
                        let slotStatus: 'available' | 'unavailable' | 'scheduled' = 'available';
                        if (slot) slotStatus = slot.status;
                        // If the slot is in the past and not scheduled, force unavailable
                        const now = new Date();
                        const slotEnd = new Date(slot ? slot.end : slotTime.getTime() + 60 * 60000);
                        if (slotEnd < now && slotStatus !== 'scheduled') {
                          slotStatus = 'unavailable';
                        }
                        const slotDateStr = `${slotTime.getFullYear()}-${String(slotTime.getMonth() + 1).padStart(2, '0')}-${String(slotTime.getDate()).padStart(2, '0')}`;
                        const isFacilityUnavailable = unavailableDates.includes(slotDateStr);
                        // When a date is blocked by system settings or bookings,
                        // force all slots to render as unavailable (red), including scheduled ones.
                        if (isFacilityUnavailable) {
                          slotStatus = 'unavailable';
                        }
                        const slotMatchesView =
                          availabilityView === 'all' ||
                          (availabilityView === 'available' && slotStatus === 'available') ||
                          (availabilityView === 'unavailable' && slotStatus !== 'available');

                        if (!slotMatchesView || (slotStatus === 'scheduled' && !showScheduled)) {
                          return <div key={hIdx} className="h-10 md:h-12 border-b border-gray-100 bg-gray-50"></div>;
                        }
                        if (slotStatus === 'available') {
                          const slotIsUnavailableBadge = isFacilityUnavailable;
                          return (
                            <div
                              key={hIdx}
                              className={cn(
                                'group relative h-10 md:h-12 cursor-pointer rounded-md border border-transparent bg-white transition hover:border-blue-300 hover:bg-blue-50',
                                slotIsUnavailableBadge && 'border-red-200 bg-red-50/60 text-red-600'
                              )}
                              tabIndex={0}
                              style={{ minHeight: 36 }}
                              onClick={() => {
                                if (typeof onSelectRange === 'function') {
                                  onSelectRange(facility.facility.id, slot?.start || slotTime.toISOString(), slot?.end || new Date(slotTime.getTime() + 60 * 60000).toISOString());
                                }
                                setSlotPreview({
                                  facilityId: facility.facility.id,
                                  slots: facility.slots
                                    .filter((s) => s.status === 'available')
                                    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                                });
                              }}
                              aria-label={`Available slot ${format(slotTime, 'hh:mm a')} at ${format(date, 'EEEE, MMMM d')}`}
                            />
                          );
                        }
                        const color = slotStatus === 'scheduled' ? 'bg-amber-300/90 text-amber-900 hover:bg-amber-300' : 'bg-red-400/90 text-white hover:bg-red-500';
                        const slotLabel = slotStatus === 'scheduled'
                          ? (isFacilityUnavailable ? 'Unavailable' : format(slotTime, 'hh:mm a'))
                          : (isFacilityUnavailable ? 'Unavailable' : format(slotTime, 'hh:mm a'));
                        return (
                          <div
                            key={hIdx}
                            className={cn(
                              'h-10 md:h-12 border-b border-gray-100 flex items-center justify-center rounded-md m-0.5 md:m-1 text-xs md:text-xs font-semibold shadow-sm transition-all duration-150',
                              color
                            )}
                            title={`${slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1)}: ${format(slotTime, 'hh:mm a')}`}
                            tabIndex={0}
                            style={{ minHeight: 36 }}
                          >
                            {slotLabel}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Main layout ---
  return (
    <div className="flex flex-col md:flex-row md:gap-6 gap-2 mt-4 md:mt-6">
      {/* Sidebar */}
      <aside className="w-full md:w-64 flex-shrink-0 mb-4 md:mb-0">
        {renderMiniCalendar()}
        {renderLegend()}
        <div className="mt-6 md:mt-8">
          <div className="font-semibold text-xs md:text-xs text-gray-700 mb-2">Rooms</div>
          <div className="space-y-1">
            {filteredRoomList.map(room => (
              <button
                key={room.name}
                className={`w-full text-left px-3 py-2 rounded-lg transition font-medium text-sm flex items-center gap-2 ${selectedRoomId === roomMap[room.name] ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
                onClick={() => setSelectedRoomId(roomMap[room.name])}
                tabIndex={0}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      </aside>
      {/* Main calendar grid */}
      <div className="w-full overflow-x-auto">{renderGrid()}</div>
    </div>
  );
}
