import React, { useEffect, useState } from "react";
import api from "../api/axios";

const OwnerBankDetailsPage = () => {
  const [form, setForm] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    upi_id: "",
  });

  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const fetchBankDetails = async () => {
    try {
      const res = await api.get("owner/bank-details/");
      const data = res.data || {};

      if (data.account_holder_name) {
        setForm(data);
        setIsVerified(!!data.is_verified);
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("owner/bank-details/", form);
      const data = res.data || {};
      alert("Bank details saved successfully!");
      setIsVerified(data.is_verified);
      setIsEditing(false);
    } catch (err) {
      alert(err.response?.data?.error || "Could not connect to the server.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="glass overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">Bank Account</h2>
            <p className="text-sm text-slate-500">Manage your payout destination</p>
          </div>
          {!isEditing && !isVerified && (
            <button onClick={() => setIsEditing(true)} className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
              Edit Details
            </button>
          )}
        </div>

        <div className="p-6">
          {isVerified && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Verified. Editing disabled for security.</div>}

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" name="account_holder_name" value={form.account_holder_name} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Account Holder" />

              <div className="grid gap-4 md:grid-cols-2">
                <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Bank Name" />
                <input type="text" name="ifsc_code" value={form.ifsc_code} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono" placeholder="IFSC" />
              </div>

              <input type="text" name="account_number" value={form.account_number} onChange={handleChange} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono" placeholder="Account Number" />

              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200">Save Details</button>
                {form.account_holder_name && <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">Cancel</button>}
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{form.bank_name}</p>
                <p className="mt-4 text-2xl font-mono tracking-wider">{form.account_number.replace(/\d(?=\d{4})/g, "•")}</p>
                <div className="mt-8 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Account Holder</p>
                    <p className="font-semibold uppercase tracking-wide">{form.account_holder_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400">IFSC</p>
                    <p className="font-mono text-sm">{form.ifsc_code}</p>
                  </div>
                </div>
                <div className="absolute -bottom-5 -right-5 h-20 w-20 rounded-full bg-white/5"></div>
              </div>

              {form.upi_id && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-sm font-medium text-slate-500">UPI ID</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{form.upi_id}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerBankDetailsPage;

