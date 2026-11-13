import React, { useState } from "react";

export interface CampusModalProps {
  open: boolean;
  initial?: { name?: string };
  title?: string;
  confirmLabel?: string;
  loading?: boolean;
  onSubmit: (data: { name: string }) => void;
  onClose: () => void;
}

export default function CampusModal({ open, initial, title = "Add Campus", confirmLabel = "Save", loading, onSubmit, onClose }: CampusModalProps) {
  const [name, setName] = useState(initial?.name || "");
  const [touched, setTouched] = useState(false);

  const valid = name.trim().length > 0 && name.length <= 100;

  React.useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setTouched(false);
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-6 relative animate-fade-in">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setTouched(true);
            if (valid) onSubmit({ name: name.trim() });
          }}
        >
          <div>
            <label className="block text-sm font-medium mb-1">Campus Name</label>
            <input
              className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              required
              autoFocus
              disabled={loading}
            />
            {touched && !valid && (
              <div className="text-xs text-red-600 mt-1">Name is required (max 100 chars).</div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
              disabled={!valid || loading}
            >
              {loading ? "Saving..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
