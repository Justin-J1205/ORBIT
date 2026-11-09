import React from "react";
import { BarChart3, MapPin } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  BarChart, Bar, CartesianGrid, XAxis, YAxis,
  LineChart, Line
} from "recharts";
import type { AnalyticsChartsProps } from "../../admin/types";
import { EmptyState } from "./EmptyState";

export function AnalyticsCharts({
  DEBUG_ANALYTICS_CHARTS,
  PIE_CHART_COLORS,
  FACILITY_BAR_COLORS,
  WEEKLY_LINE_COLORS,
  departmentChartData,
  facilityUtilizationData,
  weeklyTrendData,
  campusOptions,
  selectedAnalyticsCampusId,
  setSelectedAnalyticsCampusId,
}: AnalyticsChartsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Analytics campus</h3>
          <p className="text-xs text-gray-600">Filter all booking charts by campus.</p>
        </div>
        <select
          aria-label="Filter analytics by campus"
          value={selectedAnalyticsCampusId}
          onChange={(event) => setSelectedAnalyticsCampusId(event.target.value)}
          className="min-h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
        >
          <option value="all">All campuses</option>
          {campusOptions.map((campus) => (
            <option key={campus.id} value={campus.id}>{campus.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
      {DEBUG_ANALYTICS_CHARTS.department && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Bookings by Facility</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Top facilities by booking count</p>
            </div>
          </div>
          {departmentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={departmentChartData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} label={({ name, value }) => `${name} (${value})`}>
                  {departmentChartData.map((entry, index) => (
                    <Cell key={`dept-${entry.name}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number, _name: string, entry: any) => [`${value} bookings`, entry.name]} />
                <RechartsLegend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState Icon={MapPin} message="No facility data yet" />
          )}
        </div>
      )}

      {DEBUG_ANALYTICS_CHARTS.facility && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Facility Utilization</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Top facilities by usage hours</p>
            </div>
          </div>
          {facilityUtilizationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={facilityUtilizationData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip formatter={(value: number, name: string) => {
                  if (name === 'hours') return [`${value} hrs`, 'Usage'];
                  if (name === 'bookings') return [`${value} bookings`, 'Bookings'];
                  return [value, name];
                }} />
                <RechartsLegend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="hours" name="Hours" fill={FACILITY_BAR_COLORS.hours} radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" name="Bookings" fill={FACILITY_BAR_COLORS.bookings} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState Icon={MapPin} message="No facility usage records" />
          )}
        </div>
      )}

      {DEBUG_ANALYTICS_CHARTS.weekly && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Weekly Booking Trends</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Rolling 12-week activity snapshot</p>
            </div>
          </div>
          {weeklyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip formatter={(value: number, name: string) => [`${value} bookings`, name.charAt(0).toUpperCase() + name.slice(1)]} />
                <RechartsLegend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total" name="Total" stroke={WEEKLY_LINE_COLORS.total} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState Icon={BarChart3} message="No weekly trend data" />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
