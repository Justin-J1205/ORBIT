"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { User, FacilityBooking, SystemAlert, ActivityLog, Facility, Campus, ReportSchedule } from "@shared/schema";

type UseAdminQueriesProps = {
  isAdmin: boolean;
};

type UseAdminQueriesReturn = {
  alertsData: SystemAlert[];
  alertsLoading: boolean;
  alertsError: boolean;
  activitiesData: ActivityLog[];
  activitiesLoading: boolean;
  activitiesError: boolean;
  adminBookingsData: FacilityBooking[];
  allBookingsLoading: boolean;
  allBookingsError: boolean;
  pendingBookingsData: FacilityBooking[];
  pendingBookingsLoading: boolean;
  pendingBookingsError: boolean;
  facilitiesData: Facility[];
  facilitiesLoading: boolean;
  facilitiesError: boolean;
  campusesData: Campus[];
  usersData: User[];
  usersDataLoading: boolean;
  usersDataError: boolean;
  currentUserData: User | undefined;
  currentUserLoading: boolean;
  currentUserError: boolean;
  reportSchedulesData: ReportSchedule[];
  reportSchedulesLoading: boolean;
  reportSchedulesError: boolean;
};

export function useAdminQueries({ isAdmin }: UseAdminQueriesProps): UseAdminQueriesReturn {
  const commonQueryOpts = {
    refetchInterval: false as const,
    refetchOnWindowFocus: false,
    refetchOnMount: false as const,
  };

  const { data: alertsData = [], isLoading: alertsLoading, isError: alertsError } = useQuery({
    queryKey: ['/api/admin/alerts'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/alerts');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: activitiesData = [], isLoading: activitiesLoading, isError: activitiesError } = useQuery({
    queryKey: ['/api/admin/activity'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/activity');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: adminBookingsData = [], isLoading: allBookingsLoading, isError: allBookingsError } = useQuery({
    queryKey: ['/api/admin/bookings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/bookings');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: pendingBookingsData = [], isLoading: pendingBookingsLoading, isError: pendingBookingsError } = useQuery({
    queryKey: ['/api/bookings/pending'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/bookings/pending');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: facilitiesData = [], isLoading: facilitiesLoading, isError: facilitiesError } = useQuery({
    queryKey: ['/api/facilities'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/facilities');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: campusesData = [] } = useQuery({
    queryKey: ["/api/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campuses");
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: usersDataQ = [], isLoading: usersDataLoading, isError: usersDataError } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/users');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: currentUserData, isLoading: currentUserLoading, isError: currentUserError } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/user');
      const payload = await res.json();
      return payload?.user ?? payload;
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  const { data: reportSchedulesData = [], isLoading: reportSchedulesLoading, isError: reportSchedulesError } = useQuery({
    queryKey: ['/api/admin/report-schedules'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/report-schedules');
      return res.json();
    },
    enabled: isAdmin,
    ...commonQueryOpts,
  });

  return {
    alertsData,
    alertsLoading,
    alertsError,
    activitiesData,
    activitiesLoading,
    activitiesError,
    adminBookingsData,
    allBookingsLoading,
    allBookingsError,
    pendingBookingsData,
    pendingBookingsLoading,
    pendingBookingsError,
    facilitiesData,
    facilitiesLoading,
    facilitiesError,
    campusesData,
    usersData: usersDataQ,
    usersDataLoading,
    usersDataError,
    currentUserData,
    currentUserLoading,
    currentUserError,
    reportSchedulesData,
    reportSchedulesLoading,
    reportSchedulesError,
  };
}
