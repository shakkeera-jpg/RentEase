import React, { useEffect, useState } from "react";
import useAssetStore from "../store/useAssetStore";

const MyAssetsDashboard = () => {
  const { myAssets, fetchMyAssets, addAsset, deleteAsset, loading, error } = useAssetStore();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    city: "",
    price_per_day: "",
    availability: [{ available_from: "", available_to: "" }],
  });

  useEffect(() => {
    fetchMyAssets();
  }, []);

  const handleDateChange = (index, field, value) => {
    const newAvailability = [...formData.availability];
    newAvailability[index][field] = value;
    setFormData({ ...formData, availability: newAvailability });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await addAsset(formData);
    if (result.success) alert("Asset added!");
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-5 text-2xl font-extrabold text-slate-900">My Listed Assets</h2>
        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {myAssets.length === 0 && <p className="text-sm text-slate-500">No assets listed yet.</p>}

        <div className="space-y-3">
          {myAssets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-bold text-slate-800">{asset.title}</h3>
              <p className="text-sm text-slate-500">{asset.city} - INR {asset.price_per_day}/day</p>
              <button onClick={() => deleteAsset(asset.id)} className="mt-2 text-sm font-semibold text-rose-600 hover:underline">Delete Asset</button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 text-xl font-extrabold text-slate-900">Add New Asset</h3>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" placeholder="Title" required onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" placeholder="City" required onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" type="number" placeholder="Price per day" required onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })} />

          <p className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Availability Ranges</p>
          {formData.availability.map((range, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" type="date" required onChange={(e) => handleDateChange(i, "available_from", e.target.value)} />
              <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" type="date" required onChange={(e) => handleDateChange(i, "available_to", e.target.value)} />
            </div>
          ))}

          <button type="submit" className="mt-3 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200">
            List Asset
          </button>
        </form>
      </div>
    </div>
  );
};

export default MyAssetsDashboard;
