import React from 'react';
import { SkeletonStatsCard, SkeletonListItem } from "@/components/ui/skeleton-presets";
import { Header } from "@/components/layout";

export function AdminSuspenseFallback() {
  return (
    <div className="min-h-screen bg-background">
      <Header onMobileToggle={() => {}} />
      <div className="flex">
        {/* Desktop sidebar skeleton */}
        <div className="hidden md:block w-64 h-[calc(100vh-4rem)] bg-card fixed top-16 left-0 z-30 overflow-y-auto">
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 md:ml-64 min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
          <div className="p-3 sm:p-4 md:p-6 space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </div>
            
            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                <div className="h-6 w-48 mb-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-64 bg-gray-100 animate-pulse rounded" />
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                <div className="h-6 w-48 mb-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-64 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
            
            {/* List section */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <div className="h-6 w-48 mb-4 bg-gray-200 animate-pulse rounded" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonListItem key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
