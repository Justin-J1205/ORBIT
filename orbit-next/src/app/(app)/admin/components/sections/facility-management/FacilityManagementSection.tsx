import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getDefaultFacilityAllowedRoles } from "@shared/facilityAccess";

type Facility = {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  image: string | null;
  isActive: boolean;
  unavailableReason: string | null;
  campusId: number | null;
  campusName: string | null;
  campusIsActive: boolean;
  allowedRoles: string[];
};

type Campus = {
  id: number;
  name: string;
  isActive: boolean;
};

/* ─── Add/Edit Facility Modal ─── */
function FacilityFormModal({
  open,
  facility,
  campuses,
  title,
  confirmLabel,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  facility?: Partial<Facility> | null;
  campuses: Campus[];
  title: string;
  confirmLabel: string;
  loading?: boolean;
  onSubmit: (data: { name: string; description?: string; capacity: number; image?: string; campusId?: number | null; allowedRoles: string[] }) => void;
  onClose: () => void;
}) {
  const [name, setName] = React.useState(facility?.name || "");
  const [description, setDescription] = React.useState(facility?.description || "");
  const [capacity, setCapacity] = React.useState(facility?.capacity ?? 1);
  const [localImageName, setLocalImageName] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [campusId, setCampusId] = React.useState<number | "">(facility?.campusId ?? (campuses[0]?.id ?? ""));
  const [touched, setTouched] = React.useState(false);
  const [allowedRolesCustomized, setAllowedRolesCustomized] = React.useState(false);
  const [allowedRoles, setAllowedRoles] = React.useState<string[]>(
    facility?.allowedRoles ?? getDefaultFacilityAllowedRoles(facility?.name)
  );

  React.useEffect(() => {
    if (open) {
      setName(facility?.name || "");
      setDescription(facility?.description || "");
      setCapacity(facility?.capacity ?? 1);
      setCampusId(facility?.campusId ?? "");
      setAllowedRoles(facility?.allowedRoles ?? getDefaultFacilityAllowedRoles(facility?.name));
      setAllowedRolesCustomized(false);
      setTouched(false);
      // Split image field into local or URL
      if (facility?.image) {
        if (/^https?:\/\//.test(facility.image)) {
          setImageUrl(facility.image);
          setLocalImageName("");
        } else {
          setLocalImageName(facility.image.replace(/^\/images\//, ""));
          setImageUrl("");
        }
      } else {
        setLocalImageName("");
        setImageUrl("");
      }
      setImageFile(null);
    }
  }, [open, facility]);

  React.useEffect(() => {
    if (open && !facility && !allowedRolesCustomized) {
      setAllowedRoles(getDefaultFacilityAllowedRoles(name));
    }
  }, [name, open, facility, allowedRolesCustomized]);

  if (!open) return null;

  const valid = name.trim().length > 0 && capacity > 0 && allowedRoles.length > 0 && (localImageName || imageUrl || !imageFile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-6 mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <form
          className="space-y-4"
          onSubmit={async e => {
            e.preventDefault();
            setTouched(true);
            let imageField = "";
            if (imageUrl) {
              imageField = imageUrl.trim();
            } else if (localImageName) {
              imageField = `/images/${localImageName.trim()}`;
            } else {
              imageField = "";
            }
            if (valid)
              onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
                capacity,
                image: imageField,
                campusId: Number(campusId),
                allowedRoles,
              });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name *</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={200}
              required
              autoFocus
              disabled={loading}
            />
            {touched && !name.trim() && <p className="text-xs text-red-600 mt-1">Name is required.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={campusId}
              onChange={e => setCampusId(Number(e.target.value))}
              disabled={loading}
            >
              {campuses.filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={2000}
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                type="number"
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                min={1}
                required
                disabled={loading}
              />
              {touched && capacity < 1 && <p className="text-xs text-red-600 mt-1">Capacity must be at least 1.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Local Image File Name</label>
              <div className="flex gap-2">
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={localImageName}
                  onChange={e => setLocalImageName(e.target.value)}
                  maxLength={255}
                  disabled={loading || uploading}
                  placeholder="e.g. myimage.png"
                />
                <input
                  type="file"
                  accept="image/*"
                  className="w-32 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/admin/upload-image", {
                          method: "POST",
                          body: formData,
                        });
                        const data = await res.json();
                        if (data.fileName) {
                          setLocalImageName(data.fileName);
                        }
                      } finally {
                        setUploading(false);
                      }
                    }
                  }}
                  disabled={loading || uploading}
                  title="Upload local image (dev only)"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">Upload a local image (development only) or enter the file name (e.g. myimage.png). File will be saved to <b>/public/images</b>.</div>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">Image URL</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                maxLength={255}
                disabled={loading || uploading}
                placeholder="Paste image URL (https://...)"
              />
              <div className="text-xs text-gray-500 mt-1">Paste a remote image URL (https://...). Only one image source will be used.</div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who can book *</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={allowedRoles.join(",")}
              onChange={e => {
                setAllowedRoles(e.target.value.split(","));
                setAllowedRolesCustomized(true);
              }}
              disabled={loading}
            >
              <option value="faculty">Faculty</option>
              <option value="student,faculty">Student & Faculty</option>
              <option value="faculty,admin">Faculty & Admin</option>
              <option value="student,faculty,admin">All roles</option>
            </select>
            {touched && allowedRoles.length === 0 && <p className="text-xs text-red-600 mt-1">Select at least one role.</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              onClick={onClose}
              disabled={loading}
            >Cancel</button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              disabled={!valid || loading}
            >{loading ? "Saving..." : confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Disable Facility Modal (with reason) ─── */
function DisableFacilityModal({
  open,
  facilityName,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  facilityName: string;
  loading?: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  if (!open) return null;

  const valid = reason.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-6 mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Disable Facility</h3>
        <p className="text-sm text-gray-600 mb-4">
          Please provide a reason for disabling <span className="font-semibold">{facilityName}</span>. This reason will be shown to users.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            setTouched(true);
            if (valid) onSubmit(reason.trim());
          }}
        >
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for disabling (min 5 characters)"
            required
            minLength={5}
            disabled={loading}
            onBlur={() => setTouched(true)}
          />
          {touched && !valid && (
            <p className="text-xs text-red-600 mt-1">Reason must be at least 5 characters.</p>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              onClick={onClose}
              disabled={loading}
            >Cancel</button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              disabled={!valid || loading}
            >{loading ? "Disabling..." : "Disable Facility"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── View Reason Modal ─── */
function ViewReasonModal({ open, initialReason, loading, onSave, onClose }: {
  open: boolean;
  initialReason: string;
  loading?: boolean;
  onSave: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState(initialReason || "");
  const [touched, setTouched] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setReason(initialReason || "");
      setTouched(false);
      setJustSaved(false);
    }
  }, [open, initialReason]);
  React.useEffect(() => {
    if (!loading && justSaved) {
      setJustSaved(false);
      onClose();
    }
    // eslint-disable-next-line
  }, [loading]);
  const valid = reason.trim().length >= 5;
  const changed = reason.trim() !== (initialReason || "").trim();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-6 mx-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Facility Disabled Reason</h3>
        <form
          onSubmit={e => {
            e.preventDefault();
            setTouched(true);
            if (valid && changed) {
              setJustSaved(true);
              onSave(reason.trim());
            }
          }}
        >
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for disabling (min 5 characters)"
            required
            minLength={5}
            disabled={loading}
            onBlur={() => setTouched(true)}
          />
          {touched && !valid && (
            <p className="text-xs text-red-600 mt-1">Reason must be at least 5 characters.</p>
          )}
          <div className="flex gap-3 justify-end mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              onClick={onClose}
              disabled={loading}
            >Back</button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              disabled={!valid || !changed || loading}
            >{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Section ─── */
export default function FacilityManagementSection() {
  const queryClient = useQueryClient();
  const [formModal, setFormModal] = useState<{ open: boolean; facility: Partial<Facility> | null }>({ open: false, facility: null });
  const [disableModal, setDisableModal] = useState<{ open: boolean; facility: Facility | null }>({ open: false, facility: null });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewReason, setViewReason] = useState<{ open: boolean; facility: Facility | null }>({ open: false, facility: null });

  const { data: facilities = [], isLoading } = useQuery<Facility[]>({
    queryKey: ["/api/admin/facilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/facilities");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const { data: campuses = [] } = useQuery<Campus[]>({
    queryKey: ["/api/admin/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/campuses");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/facilities", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setFormModal({ open: false, facility: null });
    },
    onError: (e: any) => {
      setFormModal({ open: false, facility: null });
      setError(e.message || "Failed to create facility");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PUT", `/api/admin/facilities/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setFormModal({ open: false, facility: null });
      setDisableModal({ open: false, facility: null });
    },
    onError: (e: any) => {
      setFormModal({ open: false, facility: null });
      setDisableModal({ open: false, facility: null });
      setError(e.message || "Failed to update facility");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/facilities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setDeleteId(null);
    },
    onError: (e: any) => setError(e.message || "Failed to delete facility"),
  });

  const isActionLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const isEditing = formModal.facility?.id != null;

  // Group facilities by campus
  const activeCampuses = campuses.filter(c => c.isActive);
  const facilitiesByCampus = activeCampuses.map(campus => ({
    campus,
    facilities: facilities.filter(f => f.campusId === campus.id),
  }));

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-800">Facility Management</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors"
          onClick={() => {
            setFormModal({ open: true, facility: null });
            setError(null);
          }}
        >
          + Add Facility
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-2 rounded-lg text-sm">
          {error}
          <button className="ml-2 text-red-500 hover:text-red-700" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <FacilityFormModal
        open={formModal.open}
        facility={formModal.facility}
        campuses={activeCampuses}
        title={isEditing ? "Edit Facility" : "Add Facility"}
        confirmLabel={isEditing ? "Save Changes" : "Add Facility"}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={data => {
          if (isEditing && formModal.facility?.id) {
            updateMutation.mutate({ id: formModal.facility.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        onClose={() => setFormModal({ open: false, facility: null })}
      />

      {/* Loading overlay for create/update */}
      {(createMutation.isPending || updateMutation.isPending) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-white text-lg font-semibold">Saving...</div>
          </div>
        </div>
      )}

      <DisableFacilityModal
        open={disableModal.open}
        facilityName={disableModal.facility?.name || ""}
        loading={updateMutation.isPending}
        onSubmit={reason => {
          if (disableModal.facility) {
            updateMutation.mutate({ id: disableModal.facility.id, isActive: false, unavailableReason: reason });
          }
        }}
        onClose={() => setDisableModal({ open: false, facility: null })}
      />

      <ViewReasonModal
        open={viewReason.open}
        initialReason={viewReason.facility?.unavailableReason || ""}
        loading={updateMutation.isPending}
        onSave={reason => {
          if (viewReason.facility) {
            updateMutation.mutate({ id: viewReason.facility.id, unavailableReason: reason });
          }
        }}
        onClose={() => setViewReason({ open: false, facility: null })}
      />

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading facilities...</div>
      ) : facilitiesByCampus.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <p className="text-lg mb-2">No active campuses</p>
        </div>
      ) : (
        <div className="space-y-4">
          {facilitiesByCampus.map(({ campus, facilities }) => (
            <div key={campus.id} className="border rounded-lg bg-white shadow-sm">
              <div className="px-4 py-2 font-semibold text-gray-700 bg-gray-50 border-b text-sm">{campus.name}</div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-xs">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Capacity</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Image</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Who can book</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  {facilities.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-4">No facilities</td></tr>
                  ) : facilities.map(facility => (
                    <tr key={facility.id} className={!facility.isActive ? "bg-yellow-50/50" : "hover:bg-gray-50 transition-colors"}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800">{facility.name}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{facility.capacity}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {facility.image
                          ? (/^https?:\/\//.test(facility.image)
                              ? <a href={facility.image} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">URL</a>
                              : facility.image.replace(/^\/images\//, ""))
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {(facility.allowedRoles?.length
                          ? facility.allowedRoles
                          : getDefaultFacilityAllowedRoles(facility.name)
                        )
                          .map(role => role.charAt(0).toUpperCase() + role.slice(1))
                          .join(" & ")}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${facility.isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {facility.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {!facility.isActive && facility.unavailableReason && (
                            <button
                              className="px-2 py-1 text-xs font-medium bg-yellow-100 border border-yellow-200 hover:bg-yellow-200 text-yellow-700 rounded-md shadow-sm transition-colors"
                              onClick={() => setViewReason({ open: true, facility })}
                            >View Reason</button>
                          )}
                          <button
                            className="px-2 py-1 text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md shadow-sm transition-colors"
                            onClick={() => {
                              setFormModal({ open: true, facility });
                              setError(null);
                            }}
                          >Edit</button>
                          {facility.isActive ? (
                            <button
                              className="px-2 py-1 text-xs font-medium bg-yellow-50 border border-yellow-300 hover:bg-yellow-100 text-yellow-700 rounded-md shadow-sm transition-colors"
                              onClick={() => setDisableModal({ open: true, facility })}
                              disabled={isActionLoading}
                            >{updateMutation.isPending && updateMutation.variables?.id === facility.id ? (
                                <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Disabling…</span>
                              ) : "Disable"}</button>
                          ) : (
                            <button
                              className="px-2 py-1 text-xs font-medium bg-green-50 border border-green-300 hover:bg-green-100 text-green-700 rounded-md shadow-sm transition-colors"
                              onClick={() => updateMutation.mutate({ id: facility.id, isActive: true })}
                              disabled={isActionLoading}
                            >{updateMutation.isPending && updateMutation.variables?.id === facility.id ? (
                                <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enabling…</span>
                              ) : "Enable"}</button>
                          )}
                          <button
                            className="px-2 py-1 text-xs font-medium bg-red-50 border border-red-300 hover:bg-red-100 text-red-700 rounded-md shadow-sm transition-colors"
                            onClick={() => setDeleteId(facility.id)}
                            disabled={isActionLoading}
                          >{deleteMutation.isPending && deleteMutation.variables === facility.id ? (
                              <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Deleting…</span>
                            ) : "Delete"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Facility</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this facility? This action cannot be undone. All bookings associated with this facility will be affected.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                onClick={() => setDeleteId(null)}
              >Cancel</button>
              <button
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                onClick={() => deleteMutation.mutate(deleteId)}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
      {isActionLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-white text-lg font-semibold">Processing...</div>
          </div>
        </div>
      )}
    </section>
  );
}
