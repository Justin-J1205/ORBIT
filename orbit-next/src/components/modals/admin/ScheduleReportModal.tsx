"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/ui";
import { useQueryClient } from "@tanstack/react-query";

interface ScheduleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleToEdit?: any | null;
}

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const REPORT_TYPES = [
  { value: "Weekly Booking Summary", label: "Weekly Booking Summary" },
  { value: "Monthly Facility Usage", label: "Monthly Facility Usage" },
  { value: "User Activity Report", label: "User Activity Report" },
  { value: "Equipment Requests Report", label: "Equipment Requests Report" },
];

export function ScheduleReportModal({ isOpen, onClose, scheduleToEdit }: ScheduleReportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const [reportType, setReportType] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen && scheduleToEdit) {
      setReportType(scheduleToEdit.reportType || "");
      setFrequency(scheduleToEdit.frequency || "weekly");
      setDayOfWeek(scheduleToEdit.dayOfWeek ?? 1);
      setTimeOfDay(scheduleToEdit.timeOfDay || "09:00");
      setEmailRecipients(scheduleToEdit.emailRecipients || "");
      setDescription(scheduleToEdit.description || "");
    } else if (isOpen && !scheduleToEdit) {
      // Reset for new schedule
      setReportType("");
      setFrequency("weekly");
      setDayOfWeek(1);
      setTimeOfDay("09:00");
      setEmailRecipients("");
      setDescription("");
    }
  }, [isOpen, scheduleToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        reportType,
        frequency,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
        timeOfDay,
        emailRecipients,
        description,
        isActive: true,
      };

      if (scheduleToEdit) {
        // Update existing schedule
        await apiRequest("PATCH", `/api/admin/report-schedules/${scheduleToEdit.id}`, payload);
        toast({
          title: "Schedule Updated",
          description: "Report schedule has been updated successfully.",
        });
      } else {
        // Create new schedule
        await apiRequest("POST", "/api/admin/report-schedules", payload);
        toast({
          title: "Schedule Created",
          description: "Report schedule has been created successfully.",
        });
      }

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/report-schedules"] });
      onClose();
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save report schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {scheduleToEdit ? "Edit Report Schedule" : "Create Report Schedule"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} id="schedule-form" className="p-6 space-y-6 flex-1">
          <div className="space-y-2">
            <Label htmlFor="reportType">Report Type *</Label>
            <Select value={reportType} onValueChange={setReportType} required>
              <SelectTrigger id="reportType">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency *</Label>
            <Select
              value={frequency}
              onValueChange={(val: "daily" | "weekly" | "monthly") => setFrequency(val)}
              required
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Day of Week *</Label>
              <Select value={String(dayOfWeek)} onValueChange={(val) => setDayOfWeek(Number(val))}>
                <SelectTrigger id="dayOfWeek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="timeOfDay">Time of Day *</Label>
            <Input
              id="timeOfDay"
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailRecipients">Email Recipients *</Label>
            <Textarea
              id="emailRecipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder="Enter email addresses, separated by commas"
              rows={3}
              required
            />
            <p className="text-xs text-gray-500">Separate multiple emails with commas</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this schedule"
              rows={3}
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="schedule-form"
            disabled={isLoading || !reportType || !emailRecipients}
            className="bg-pink-600 hover:bg-pink-700"
          >
            {isLoading ? "Saving..." : scheduleToEdit ? "Update Schedule" : "Create Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
