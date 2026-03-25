import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import MyRequests from "../components/MyRequests";
import useProfileStore from "../store/ProfileStore";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { canPerformVerifiedActions } from "../utils/profileStatus";

const MY_RENTALS_POLL_INTERVAL_MS = 30000;

const MyRentals = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    city: "",
    category: "",
    price_per_day: "",
    asset_image: null,
    available_from: "",
    available_to: "",
    deposit: "",
  });

  useEffect(() => {
    const refresh = () => fetchData();
    window.addEventListener("new_request", refresh);
    window.addEventListener("request_approved", refresh);
    window.addEventListener("request_rejected", refresh);
    window.addEventListener("realtime_update", refresh);
    window.addEventListener("new_notification", refresh);

    const intervalId = setInterval(() => {
      if (!document.hidden) {
        refresh();
      }
    }, MY_RENTALS_POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("new_request", refresh);
      window.removeEventListener("request_approved", refresh);
      window.removeEventListener("request_rejected", refresh);
      window.removeEventListener("realtime_update", refresh);
      window.removeEventListener("new_notification", refresh);
      clearInterval(intervalId);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [assetRes, categoryRes] = await Promise.all([api.get("my-assets/"), api.get("categories/")]);
      setAssets(assetRes.data);
      setCategories(categoryRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, asset_image: e.target.files[0] });
  };

  const handleEditClick = (asset) => {
    setEditingAssetId(asset.id);
    setFormData({
      title: asset.title,
      description: asset.description,
      city: asset.city,
      category: asset.category,
      price_per_day: asset.price_per_day,
      deposit: asset.deposit || "",
      available_from: asset.availability[0]?.available_from || "",
      available_to: asset.availability[0]?.available_to || "",
      asset_image: null,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this asset?")) {
      try {
        await api.delete(`my-assets/${id}/`);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.detail || "Error deleting asset.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("category", formData.category);
    data.append("price_per_day", formData.price_per_day);
    data.append("deposit", formData.deposit);

    if (formData.asset_image) data.append("asset_image", formData.asset_image);

    data.append(
      "availability",
      JSON.stringify([
        {
          available_from: formData.available_from,
          available_to: formData.available_to,
        },
      ])
    );

    try {
      if (editingAssetId) {
        await api.put(`my-assets/${editingAssetId}/`, data);
      } else {
        await api.post("my-assets/", data);
      }
      closeModal();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || "Action failed. Check profile status.");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAssetId(null);
    setFormData({
      title: "",
      description: "",
      city: "",
      category: "",
      price_per_day: "",
      asset_image: null,
      available_from: "",
      available_to: "",
      deposit: "",
    });
  };

  if (loading) return <div className="p-10 text-slate-600 font-medium">Loading...</div>;
  const canManageAssets = canPerformVerifiedActions(profile);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <h1 className="m-0 text-3xl font-bold text-slate-900">My Rental Assets</h1>
          <p className="text-slate-500">Managing assets for <b className="text-slate-800">{user || "User"}</b></p>
        </div>
        <button
          className={`rounded-xl px-6 py-3 font-semibold text-white shadow-md ${
            canManageAssets
              ? "bg-gradient-to-r from-teal-600 to-emerald-500 shadow-emerald-200"
              : "bg-slate-400"
          }`}
          onClick={() => {
            if (!canManageAssets) {
              alert("Admin approval is required before adding or editing assets.");
              navigate("/profile");
              return;
            }
            setShowModal(true);
          }}
        >
          + Add New Asset
        </button>
      </div>

      {!canManageAssets && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You can view your dashboard now, but listing or editing assets is unlocked only after admin approval.
        </div>
      )}

      <MyRequests />

      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-8 shadow-2xl">
            <h2 className="mb-6 text-xl font-bold">{editingAssetId ? "Edit Asset" : "Add New Asset"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input className="w-full rounded-lg border border-slate-300 p-2.5" name="title" placeholder="Asset Title" value={formData.title} onChange={handleInputChange} required />

              <select className="w-full rounded-lg border border-slate-300 bg-white p-2.5" name="category" value={formData.category} onChange={handleInputChange} required>
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <textarea className="h-20 w-full rounded-lg border border-slate-300 p-2.5" name="description" placeholder="Description" value={formData.description} onChange={handleInputChange} required />

              <input className="w-full rounded-lg border border-slate-300 bg-gray-100 p-2.5" value={profile?.panchayat_name || ""} disabled />
              <input className="w-full rounded-lg border border-slate-300 p-2.5" type="number" name="price_per_day" placeholder="Price per day" value={formData.price_per_day} onChange={handleInputChange} required />
              <input className="w-full rounded-lg border border-blue-200 bg-blue-50 p-2.5" type="number" name="deposit" placeholder="Security Deposit" value={formData.deposit} onChange={handleInputChange} required />
              <input className="w-full rounded-lg border border-slate-300 p-2.5" type="file" onChange={handleFileChange} accept="image/*" />

              <div className="flex gap-3">
                <input className="w-full rounded-lg border border-slate-300 p-2.5" type="date" name="available_from" value={formData.available_from} onChange={handleInputChange} required />
                <input className="w-full rounded-lg border border-slate-300 p-2.5" type="date" name="available_to" value={formData.available_to} onChange={handleInputChange} required />
              </div>

              <div className="mt-5 flex gap-3">
                <button type="submit" className="flex-1 rounded-lg bg-teal-600 py-2.5 font-bold text-white">Save Asset</button>
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg bg-slate-600 py-2.5 font-bold text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <div key={asset.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lg shadow-slate-200">
            <img src={resolveMediaUrl(asset.asset_image) || "https://via.placeholder.com/300x180"} alt={asset.title} className="h-48 w-full object-cover" />
            <div className="p-5">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="m-0 text-lg font-bold text-slate-800">{asset.title}</h3>
                <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {categories.find((c) => c.id === asset.category)?.name || "Asset"}
                </span>
              </div>
              <p className="mb-4 text-sm text-slate-500">Location: {asset.city}</p>
              <div className="mb-5 text-xl font-black text-teal-700">INR {asset.price_per_day} <span className="text-xs font-normal text-slate-400">/ day</span></div>

              <div className="flex gap-2">
                <button onClick={() => handleEditClick(asset)} className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-teal-700 hover:bg-teal-50">Edit</button>
                <button onClick={() => handleDelete(asset.id)} className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyRentals;
