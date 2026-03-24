import React, { useEffect, useState } from "react";
import api from "../api/axios";

const AdminSettlementPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchSettlements();
  }, []);

  const fetchSettlements = async () => {
    try {
      const res = await api.get("settlements/");
      setBookings(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (id) => {
    const confirmAction = window.confirm(
      "This will automatically refund the renter (if applicable). After that, you must manually transfer the owner payout. Continue?"
    );

    if (!confirmAction) return;

    setProcessingId(id);

    try {
      const res = await api.post(`settlements/${id}/settle/`, {});
      const data = res.data || {};
      alert(`Refund Successful!\nRefund ID: ${data.refund_id || "No refund needed"}\n\nNow manually transfer INR ${data.owner_payout} to owner.`);
      setBookings(bookings.filter((b) => b.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || "Server error");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <h3 className="text-sm font-semibold text-slate-500">Loading settlements...</h3>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-slate-900">Admin Settlement Dashboard</h2>

      {bookings.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No pending settlements found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Owner Bank</th>
                <th className="px-4 py-3">Renter</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Penalty</th>
                <th className="px-4 py-3">Owner Payout</th>
                <th className="px-4 py-3">Renter Refund</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">{b.asset}</td>
                  <td className="px-4 py-3">{b.owner}</td>
                  <td className="px-4 py-3">
                    {b.owner_bank_name}
                    <br />
                    <small className="text-slate-500">{b.owner_account_number}</small>
                  </td>
                  <td className="px-4 py-3">{b.renter}</td>
                  <td className="px-4 py-3">INR {b.deposit}</td>
                  <td className="px-4 py-3">INR {b.penalty}</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">INR {b.owner_payout}</td>
                  <td className="px-4 py-3 text-blue-700">INR {b.renter_refund}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSettle(b.id)}
                      disabled={processingId === b.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {processingId === b.id ? "Processing..." : "Settle & Refund"}
                    </button>
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

export default AdminSettlementPage;
