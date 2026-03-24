import React, { useEffect, useState } from "react";
import useProductStore from "../store/ProductStore";

const MyRequests = () => {
  const { ownerRequests, fetchOwnerRequests, manageRequest, finalizeBooking } = useProductStore();
  const [penalties, setPenalties] = useState({});

  useEffect(() => {
    fetchOwnerRequests();

    const refresh = () => fetchOwnerRequests();
    window.addEventListener("new_request", refresh);
    window.addEventListener("request_approved", refresh);
    window.addEventListener("request_rejected", refresh);
    window.addEventListener("realtime_update", refresh);
    window.addEventListener("new_notification", refresh);

    const intervalId = setInterval(refresh, 6000);

    return () => {
      window.removeEventListener("new_request", refresh);
      window.removeEventListener("request_approved", refresh);
      window.removeEventListener("request_rejected", refresh);
      window.removeEventListener("realtime_update", refresh);
      window.removeEventListener("new_notification", refresh);
      clearInterval(intervalId);
    };
  }, [fetchOwnerRequests]);

  const handlePenaltyChange = (id, value) => {
    setPenalties({ ...penalties, [id]: value });
  };

  return (
    <div className="glass rounded-2xl p-4 md:p-6">
      <h3 className="mb-4 text-2xl font-bold text-slate-800">Lending Dashboard</h3>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="p-4 text-xs font-semibold uppercase text-slate-500">Asset & Renter</th>
              <th className="p-4 text-xs font-semibold uppercase text-slate-500">Dates</th>
              <th className="p-4 text-xs font-semibold uppercase text-slate-500">Total (Held)</th>
              <th className="p-4 text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="p-4 text-center text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ownerRequests.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-slate-50/60">
                <td className="p-4">
                  <div className="font-bold text-slate-900">{req.asset_title}</div>
                  <div className="text-sm text-slate-500">Renter: {req.renter_name || req.renter}</div>
                  {req.renter_details && (
                    <div className="mt-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{req.renter_details.email}</span>
                      {req.renter_details.phone ? (
                        <span className="ml-2">• {req.renter_details.phone}</span>
                      ) : null}
                      {typeof req.renter_details.trust_score === "number" ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          Score: {req.renter_details.trust_score}
                        </span>
                      ) : null}
                      {req.renter_details.verification_status ? (
                        <span className="ml-2">• {req.renter_details.verification_status}</span>
                      ) : null}
                      {(req.renter_details.district || req.renter_details.taluk || req.renter_details.panchayat) ? (
                        <div className="mt-1 text-[11px] text-slate-400">
                          {req.renter_details.district || "—"}{" "}
                          {req.renter_details.taluk ? `> ${req.renter_details.taluk}` : ""}{" "}
                          {req.renter_details.panchayat ? `> ${req.renter_details.panchayat}` : ""}
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-600">
                  {req.start_date} <span className="mx-1 text-slate-400">to</span> {req.end_date}
                </td>
                <td className="p-4 text-sm font-semibold text-slate-900">INR {req.total_paid}</td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      req.status === "OWNER_PENDING"
                        ? "bg-amber-100 text-amber-700"
                        : req.status === "APPROVED"
                          ? "bg-blue-100 text-blue-700"
                          : req.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : req.status === "RETURN_REQUESTED"
                              ? "bg-purple-100 text-purple-700"
                              : req.status === "COMPLETED"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {req.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    {req.status === "OWNER_PENDING" && (
                      <>
                        <button onClick={() => manageRequest(req.id, "approve")} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700">Approve</button>
                        <button onClick={() => manageRequest(req.id, "reject")} className="rounded-md border border-rose-200 px-4 py-1.5 text-sm text-rose-600 hover:bg-rose-50">Reject</button>
                      </>
                    )}

                    {req.status === "APPROVED" && <span className="text-xs italic text-blue-500">Waiting for renter pickup...</span>}
                    {req.status === "ACTIVE" && <span className="text-xs font-bold text-emerald-600">Item with renter</span>}

                    {req.status === "RETURN_REQUESTED" && (
                      <div className="flex items-center gap-2 rounded-lg border border-purple-100 bg-purple-50 p-2">
                        <input type="number" placeholder="Penalty INR" className="w-24 rounded border border-purple-200 px-2 py-1 text-sm" value={penalties[req.id] || ""} onChange={(e) => handlePenaltyChange(req.id, e.target.value)} />
                        <button onClick={() => finalizeBooking(req.id, penalties[req.id])} className="rounded bg-purple-600 px-3 py-1 text-sm font-bold text-white hover:bg-purple-700">
                          Finalize & Payout
                        </button>
                      </div>
                    )}

                    {req.status === "COMPLETED" && <span className="text-sm text-slate-400">Done</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyRequests;
