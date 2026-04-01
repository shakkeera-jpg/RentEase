import React, { useEffect } from "react";
import useAdminStore from "../store/AdminStore";
import { resolveMediaUrl } from "../utils/mediaUrl";

const Verification = () => {
  const { pendingList, fetchPending, processVerification, loading } = useAdminStore();

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  if (loading) return <p className="text-sm font-semibold text-slate-500">Loading verifications...</p>;

  const handleViewDocument = (docUrl) => {
    const finalUrl = resolveMediaUrl(docUrl);
    if (finalUrl) {
      window.open(finalUrl, "_blank");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-slate-900">Verification Requests</h2>
      {pendingList.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No pending requests.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingList.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleViewDocument(user.id_document)}
                      className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700"
                    >
                      View ID Document
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => processVerification(user.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                      <button
                        onClick={() => {
                          const r = prompt("Reason for rejection:");
                          if (r) processVerification(user.id, "REJECTED", r);
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Verification;
