"use client";

import React, { useMemo, useState } from "react";
import { User, ActivityLog, Facility } from "@shared/schema";

export function useAdminUtilities() {
  const [usersData, setUsersData] = useState<User[] | undefined>(undefined);
  const [activities, setActivities] = useState<ActivityLog[] | undefined>(undefined);
  const [facilities, setFacilities] = useState<Facility[] | undefined>(undefined);
  const [user, setUser] = useState<User | undefined>(undefined);

  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    (usersData || []).forEach((u: User) => map.set(String(u.id), u));
    return map;
  }, [usersData]);

  function getUserEmail(id: any) {
    if (!id) return 'Unknown';
    return usersData?.find(u => u.id === id)?.email || String(id);
  }

  function getUserRole(id: any) {
    if (!id) return 'Unknown';
    const role = usersData?.find(u => String(u.id) === String(id))?.role;
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Not recorded';
  }

  function getFacilityName(id: any) {
    if (!id) return 'Unknown Facility';
    return facilities?.find(f => f.id === id)?.name || String(id);
  }

  function abbreviateFacilityName(name: string): string {
    if (!name) return name;
    const abbrevMap: Record<string, string> = {
      'Collaborative Learning Room 1': 'CLR 1',
      'Collaborative Learning Room 2': 'CLR 2',
      'Faculty Lounge': 'Faculty Lounge',
      'Board Room': 'Board Room',
    };
    return abbrevMap[name] || (name.length > 20 ? name.substring(0, 17) + '...' : name);
  }

  const renderStatusBadge = (statusRaw: any) => {
    const s = String(statusRaw || '').toLowerCase();
    let label = (statusRaw && String(statusRaw)) || 'Unknown';
    let classes = 'text-sm font-medium px-2 py-1 rounded-full';

    if (s === 'pending' || s === 'request' || s === 'requested') {
      label = 'Pending approval';
      classes += ' bg-blue-100 text-blue-800';
    } else if (s === 'approved' || s === 'completed') {
      label = (s === 'approved') ? 'Approved' : 'Completed';
      classes += ' bg-green-100 text-green-800';
    } else if (s === 'denied' || s === 'cancelled' || s === 'canceled') {
      label = (s === 'denied') ? 'Denied' : 'Cancelled';
      classes += ' bg-red-100 text-red-800';
    } else if (s === 'expired' || s === 'void') {
      label = 'Expired';
      classes += ' bg-gray-100 text-gray-800';
    } else {
      classes += ' bg-gray-100 text-gray-800';
    }

    return React.createElement('span', { className: classes }, label);
  };

  return {
    usersData,
    setUsersData,
    activities,
    setActivities,
    facilities,
    setFacilities,
    user,
    setUser,
    usersMap,
    getUserEmail,
    getUserRole,
    getFacilityName,
    abbreviateFacilityName,
    renderStatusBadge,
  };
}
