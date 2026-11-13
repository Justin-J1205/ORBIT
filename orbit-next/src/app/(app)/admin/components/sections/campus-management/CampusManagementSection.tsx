import React, { useState } from "react";
import { useQuery as useRQ, useMutation as useMut, useQueryClient as useQC } from "@tanstack/react-query";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import CampusModal from "@/components/modals/campus/CampusModal";

type Campus = {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder?: number;
};
type Facility = {
  id: number;
  name: string;
};

export default function CampusManagementSection() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<Campus> | undefined>(undefined);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteFacilities, setDeleteFacilities] = useState<Facility[] | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: campuses = [], isLoading } = useQuery<Campus[]>({
    queryKey: ["/api/admin/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/campuses");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Campus>) => {
      const res = await apiRequest("POST", "/api/admin/campuses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campuses"] });
      setModalOpen(false);
    },
    onError: (e: any) => setError(e.message || "Failed to create campus"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Campus> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/admin/campuses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campuses"] });
      setModalOpen(false);
    },
    onError: (e: any) => setError(e.message || "Failed to update campus"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/campuses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campuses"] });
      setDeleteId(null);
      setDeleteFacilities(null);
    },
    onError: (e: any) => setError(e.message || "Failed to delete campus"),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Campus Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage campuses and their availability</p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-colors"
          onClick={() => {
            setModalMode("add");
            setModalInitial(undefined);
            setModalOpen(true);
            setError(null);
          }}
        >
          + Add Campus
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4 rounded-lg text-sm">
          {error}
          <button className="ml-2 text-red-500 hover:text-red-700" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <CampusModal
        open={modalOpen}
        initial={modalInitial}
        title={modalMode === "add" ? "Add Campus" : "Edit Campus"}
        confirmLabel={modalMode === "add" ? "Add Campus" : "Save Changes"}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={data => {
          if (modalMode === "add") createMutation.mutate(data);
          else if (modalMode === "edit" && modalInitial?.id) updateMutation.mutate({ ...data, id: modalInitial.id });
        }}
        onClose={() => setModalOpen(false)}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
            <svg className="animate-spin h-6 w-6 mb-2 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Loading campuses...
          </div>
        ) : campuses.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-lg mb-2">No campuses yet</p>
            <p className="text-sm">Click &quot;+ Add Campus&quot; to create your first campus.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wide">Order</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600 uppercase text-xs tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campuses.map(campus => (
                  <tr key={campus.id} className={!campus.isActive ? "bg-yellow-50/50" : "hover:bg-gray-50 transition-colors"}>
                    <td className="px-5 py-3 font-medium text-gray-800">{campus.name}</td>
                    <td className="px-5 py-3 text-gray-500">{campus.sortOrder ?? 0}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${campus.isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {campus.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                      <button
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md shadow-sm transition-colors"
                        onClick={() => {
                          setModalMode("edit");
                          setModalInitial(campus);
                          setModalOpen(true);
                          setError(null);
                        }}
                      >Edit</button>
                      {campus.isActive ? (
                        <button
                          className="px-3 py-1.5 text-xs font-medium bg-yellow-50 border border-yellow-300 hover:bg-yellow-100 text-yellow-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: campus.id, isActive: false })}
                        >{updateMutation.isPending && updateMutation.variables?.id === campus.id ? (
                            <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Disabling…</span>
                          ) : "Disable"}</button>
                      ) : (
                        <button
                          className="px-3 py-1.5 text-xs font-medium bg-green-50 border border-green-300 hover:bg-green-100 text-green-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: campus.id, isActive: true })}
                        >{updateMutation.isPending && updateMutation.variables?.id === campus.id ? (
                            <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enabling…</span>
                          ) : "Enable"}</button>
                      )}
                      <button
                        className="px-3 py-1.5 text-xs font-medium bg-red-50 border border-red-300 hover:bg-red-100 text-red-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={async () => {
                          setDeleteLoading(true);
                          setDeleteId(campus.id);
                          setDeleteFacilities(null);
                          try {
                            const res = await apiRequest("GET", `/api/admin/facilities?campusId=${campus.id}`);
                            const facilities: Facility[] = await res.json();
                            setDeleteFacilities(facilities);
                          } catch (e) {
                            setDeleteFacilities([]);
                          } finally {
                            setDeleteLoading(false);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >{deleteMutation.isPending && deleteMutation.variables === campus.id ? (
                          <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Deleting…</span>
                        ) : "Delete"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog with Facilities List */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Campus</h3>
            {deleteLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Loading facilities…</div>
            ) : (
              <>
                {deleteFacilities && deleteFacilities.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-3">This campus has the following facilities. <span className="font-semibold text-red-600">Deleting the campus will also delete all these facilities and their bookings.</span></p>
                    <ul className="mb-3 max-h-40 overflow-y-auto border border-gray-100 rounded bg-gray-50 px-3 py-2">
                      {deleteFacilities.map(f => (
                        <li key={f.id} className="py-1 text-gray-800">{f.name}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this campus? This action cannot be undone.</p>
                )}
                <div className="flex gap-3 justify-end mt-2">
                  <button
                    className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                    onClick={() => { setDeleteId(null); setDeleteFacilities(null); }}
                    disabled={deleteMutation.isPending}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => deleteMutation.mutate(deleteId)}
                    disabled={deleteMutation.isPending}
                  >{deleteMutation.isPending ? (
                      <span className="inline-flex items-center gap-1"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Deleting…</span>
                    ) : "Delete"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
