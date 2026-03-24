import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useProfileStore from "../store/ProfileStore";
import api from "../api/axios";
import {
  canAccessGeneralRoutes,
  isVerificationRejected,
  needsVerificationUpload,
} from "../utils/profileStatus";

const Profile = () => {
  const navigate = useNavigate();
  const { profile, fetchProfile, updateBasicDetails, uploadID, loading } = useProfileStore();

  const [basicData, setBasicData] = useState({ phone: "", address: "", panchayat: "" });
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [panchayats, setPanchayats] = useState([]);
  const [selDistrict, setSelDistrict] = useState("");
  const [selTaluk, setSelTaluk] = useState("");
  const [file, setFile] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    const init = async () => {
      const data = await fetchProfile();
      if (canAccessGeneralRoutes(data)) {
        navigate("/");
      }
      try {
        const res = await api.get("districts/");
        setDistricts(res.data);
      } catch (e) {
        console.error("Error fetching districts", e);
      }
    };
    init();
  }, [fetchProfile, navigate]);

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

  const handleBasicSubmit = async (e) => {
    e.preventDefault();
    if (!basicData.panchayat) return alert("Please select your Panchayat");
    const payload = { ...basicData };
    if (profilePhoto) payload.profile_photo = profilePhoto;
    const res = await updateBasicDetails(payload);
    if (res.success) await fetchProfile();
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file first");
    const res = await uploadID(file);
    if (res.success) navigate("/");
  };

  if (loading || !profile) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Syncing profile...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="glass rounded-3xl p-6 md:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">Profile Setup</h2>
          <p className="mt-2 text-sm text-slate-500">Complete your account details to continue on RentEase.</p>
        </div>

        {!profile.is_completed ? (
          <form onSubmit={handleBasicSubmit} className="grid gap-4 md:grid-cols-2">
            <div
              className="md:col-span-2 cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition-all hover:border-teal-400 hover:bg-teal-50"
              onClick={() => document.getElementById("profilePhotoInput").click()}
            >
              <p className="text-sm font-medium text-slate-600">
                {profilePhoto ? profilePhoto.name : "Click to upload profile photo (optional)"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">JPG/PNG recommended.</p>
              <input
                id="profilePhotoInput"
                type="file"
                className="hidden"
                onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
                accept="image/*"
              />
            </div>

            <input className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500" type="text" placeholder="Phone Number" value={basicData.phone} onChange={(e) => setBasicData({ ...basicData, phone: e.target.value })} required />

            <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500" value={selDistrict} onChange={handleDistrictChange} required>
              <option value="">Select District</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 disabled:opacity-50" value={selTaluk} onChange={handleTalukChange} disabled={!selDistrict} required>
              <option value="">Select Taluk</option>
              {taluks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 disabled:opacity-50" value={basicData.panchayat} onChange={(e) => setBasicData({ ...basicData, panchayat: e.target.value })} disabled={!selTaluk} required>
              <option value="">Select Panchayat</option>
              {panchayats.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <textarea className="md:col-span-2 min-h-[90px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500" placeholder="Street Address / House No." value={basicData.address} onChange={(e) => setBasicData({ ...basicData, address: e.target.value })} required />

            <button type="submit" className="md:col-span-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200">
              {loading ? "Saving..." : "Save & Continue"}
            </button>
          </form>
        ) : (
          <div className="space-y-5 text-center">
            <h3 className="text-2xl font-extrabold text-slate-900">Identity Verification</h3>
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              profile.verification_status === "APPROVED"
                ? "bg-emerald-100 text-emerald-700"
                : profile.verification_status === "REJECTED"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
            }`}>
              {profile.verification_status.replace("_", " ")}
            </span>

            {needsVerificationUpload(profile) ? (
              <div className="space-y-4">
                {isVerificationRejected(profile) && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
                    <p className="text-sm font-bold text-rose-700">Verification rejected</p>
                    <p className="mt-1 text-sm text-rose-600">
                      {profile.rejection_reason || "Your ID was rejected. Please upload a clearer valid document."}
                    </p>
                  </div>
                )}
                <div className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition-all hover:border-teal-400 hover:bg-teal-50" onClick={() => document.getElementById("fileInput").click()}>
                  <p className="text-sm font-medium text-slate-600">{file ? file.name : "Click to select ID document"}</p>
                  <input id="fileInput" type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf" />
                </div>
                <button onClick={handleFileSubmit} className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200">
                  {isVerificationRejected(profile) ? "Re-upload for Approval" : "Submit for Approval"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Under review. You can continue browsing while we verify your document.</p>
                <button onClick={() => navigate("/")} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white">Go Home</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
