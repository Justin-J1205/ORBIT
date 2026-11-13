"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/ui";
import { useQueryClient } from "@tanstack/react-query";

interface DeleteScheduleConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any | null;
}

export function DeleteScheduleConfirmModal({ isOpen, onClose, schedule }: DeleteScheduleConfirmModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!schedule) return;
    
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", `/api/admin/report-schedules/${schedule.id}`);
      toast({
        title: "Schedule Deleted",
        description: "Report schedule has been deleted successfully.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/report-schedules"] });
      onClose();
    } catch (error: any) {
      console.error("Error deleting schedule:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete report schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !schedule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-900">Delete Report Schedule</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Are you sure you want to delete the schedule for <span className="font-semibold">{schedule.reportType}</span>?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone. The schedule will be permanently removed and no future reports will be sent.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Schedule"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeleteScheduleConfirmModal;
