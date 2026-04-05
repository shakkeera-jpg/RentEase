import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useProfileStore from "../store/ProfileStore";
import { CheckCircle, Edit3, Phone, Save, ShieldCheck, Smartphone } from "lucide-react";
import api from "../api/axios";
import { addCacheBuster, resolveMediaUrl } from "../utils/mediaUrl";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, fetchProfile, updateBasicDetails, loading, profilePhotoVersion } = useProfileStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newProfilePhoto, setNewProfilePhoto] = useState(null);
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [photoRefreshAttempted, setPhotoRefreshAttempted] = useState(false);

  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [panchayats, setPanchayats] = useState([]);

  const [formData, setFormData] = useState({ phone: "", address: "", panchayat: "" });
  const [selDistrict, setSelDistrict] = useState("");
  const [selTaluk, setSelTaluk] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchProfile();
      if (data) {
        setFormData({
          phone: data.phone || "",
          address: data.address || "",
          panchayat: data.panchayat || "",
        });
        setNewProfilePhoto(null);
      }
    };
    loadData();
    fetchDistricts();
  }, [fetchProfile]);

  useEffect(() => {
    if (photoRefreshAttempted) {
      setPhotoRefreshAttempted(false);
    }
  }, [profile?.profile_photo]);

  const fetchDistricts = async () => {
    try {
      const res = await api.get("districts/");
      setDistricts(res.data);
    } catch (e) {
      console.error("Error fetching districts", e);
    }
  };

  const handleDistrictChange = async (e) => {
    const id = e.target.value;
    setSelDistrict(id);
    setSelTaluk("");
    setTaluks([]);
    setPanchayats([]);
    if (id) {
      const res = await api.get(`taluks/${id}/`);
      setTaluks(res.data);
    }
  };

  const handleTalukChange = async (e) => {
    const id = e.target.value;
    setSelTaluk(id);
    setPanchayats([]);
    if (id) {
      const res = await api.get(`panchayats/${id}/`);
      setPanchayats(res.data);
    }
  };

  const handleSave = async () => {
    const payload = { ...formData };
    if (newProfilePhoto) payload.profile_photo = newProfilePhoto;
    const res = await updateBasicDetails(payload);
    if (res.success) {
      setIsEditing(false);
      setPhotoVersion(Date.now());
      await fetchProfile();
    } else {
      alert("Update failed.");
    }
  };

  const handleDisableMFA = async () => {
    if (window.confirm("Are you sure you want to disable Multi-Factor Authentication?")) {
      try {
        await api.post("disable-mfa/", {});
        await fetchProfile();
        alert("MFA has been disabled.");
      } catch (e) {
        console.error("Error disabling MFA", e);
        alert("Failed to disable MFA.");
      }
    }
  };

  if (!profile) return <div className="p-10 text-center text-gray-500">Loading...</div>;

  const trustScore =
    typeof profile?.trust_score === "number" ? profile.trust_score : null;
  const trustScoreMeta =
    typeof trustScore === "number" && trustScore >= 750
      ? { label: "Excellent", badge: "bg-emerald-100 text-emerald-700" }
      : typeof trustScore === "number" && trustScore >= 650
        ? { label: "Good", badge: "bg-amber-100 text-amber-700" }
        : typeof trustScore === "number"
          ? { label: "Low", badge: "bg-rose-100 text-rose-700" }
          : null;

  const avatarChar = profile?.name?.charAt(0)?.toUpperCase() || "U";
  const profilePhotoUrl = resolveMediaUrl(profile?.profile_photo);
  const profilePhotoRenderUrl = addCacheBuster(
    profilePhotoUrl,
    `${profilePhotoVersion}-${photoVersion}`
  );
  const pendingPhotoLabel = newProfilePhoto ? newProfilePhoto.name : "Upload profile photo (optional)";
  const handlePhotoError = async () => {
    if (photoRefreshAttempted) return;
    setPhotoRefreshAttempted(true);
    await fetchProfile({ force: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-md shadow-teal-200">
            {profilePhotoRenderUrl ? (
              <img
                src={profilePhotoRenderUrl}
                alt={profile.name}
                className="h-full w-full object-cover"
                onError={handlePhotoError}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-extrabold">{avatarChar}</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{profile.name}</h1>
            <p className="text-sm text-slate-500">{profile.user_email}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${profile.verification_status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {profile.verification_status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass md:col-span-2 rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Profile Photo</h3>
          {isEditing ? (
            <div
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition-all hover:border-teal-400 hover:bg-teal-50"
              onClick={() => document.getElementById("profilePhotoEditInput").click()}
            >
              <p className="text-sm font-medium text-slate-600">{pendingPhotoLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Leave empty to keep current photo.</p>
              <input
                id="profilePhotoEditInput"
                type="file"
                className="hidden"
                onChange={(e) => setNewProfilePhoto(e.target.files?.[0] || null)}
                accept="image/*"
              />
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-600">{profilePhotoUrl ? "Photo added" : "No profile photo"}</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Phone size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Contact</h3>
          </div>
          {isEditing ? (
            <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          ) : (
            <p className="font-medium text-slate-800">{profile.phone || "No phone added"}</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Security</h3>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Smartphone size={16} className={profile.mfa_enabled ? "text-emerald-600" : "text-slate-400"} />
              Two-Factor Auth
            </div>
            {profile.mfa_enabled ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle size={14} /> ACTIVE</span>
                <button onClick={handleDisableMFA} className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">DISABLE</button>
              </div>
            ) : (
              <button onClick={() => navigate("/setupmfa")} className="text-xs font-semibold text-teal-700 hover:underline">Enable MFA</button>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">AI Trust Score</h3>
            {trustScoreMeta && (
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${trustScoreMeta.badge}`}>
                {trustScoreMeta.label}
              </span>
            )}
          </div>
          {typeof trustScore === "number" ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-extrabold text-slate-900">{trustScore}</p>
                <p className="mt-1 text-xs text-slate-500">Updates after settlements (penalties/damages).</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">Range: 0–1000</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not available yet.</p>
          )}
        </div>

        <div className="glass md:col-span-2 rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Location & Address</h3>
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" value={selDistrict} onChange={handleDistrictChange}>
                  <option value="">District</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50" value={selTaluk} onChange={handleTalukChange} disabled={!selDistrict}>
                  <option value="">Taluk</option>
                  {taluks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50" value={formData.panchayat} onChange={(e) => setFormData({ ...formData, panchayat: e.target.value })} disabled={!selTaluk}>
                  <option value="">Panchayat</option>
                  {panchayats.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <textarea className="min-h-[84px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">{profile.district ? `${profile.district} > ${profile.taluk} > ${profile.panchayat_name}` : "Location not set"}</p>
              <p className="mt-2 text-sm text-slate-800">{profile.address || "Address not provided"}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-200">
              <Save size={15} />
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white">
            <Edit3 size={15} />
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
