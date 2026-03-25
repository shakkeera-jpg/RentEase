import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { startChat } from "../api/chatApi";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import api from "../api/axios";
import { resolveMediaUrl } from "../utils/mediaUrl";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import { canPerformVerifiedActions } from "../utils/profileStatus";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { profile, fetchProfile, hydrated, loading: profileLoading } = useProfileStore();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const handleChat = async () => {
  try {
    const res = await startChat(asset.id);
    const conversationId = res.data.conversation_id;

    navigate(`/chat/${conversationId}`);

  } catch (err) {
    console.error("Chat start error:", err);
  }
};
  useEffect(() => {
    if (isAuthenticated && !profile && !hydrated && !profileLoading) {
      fetchProfile();
    }
  }, [isAuthenticated, profile, hydrated, profileLoading, fetchProfile]);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const res = await api.get(`rentals/assets/${id}/`);
        setAsset(res.data);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [id]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await api.get(`assets/${id}/reviews/`);
        setReviews(res.data || []);
      } catch (err) {
        console.error("Reviews fetch error:", err);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading details...</div>;
  if (!asset) return <div className="p-20 text-center">Asset not found.</div>;

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length) * 10) / 10
    : null;
  const canRent = !isAuthenticated || canPerformVerifiedActions(profile);

  const handleRentClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!canPerformVerifiedActions(profile)) {
      alert("Your account must be admin-approved before renting products.");
      navigate("/profile");
      return;
    }
    navigate("/payment", { state: { asset } });
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <ArrowLeft size={14} />
          Back to Gallery
        </button>

        <div className="glass overflow-hidden rounded-3xl p-3">
          <img src={resolveMediaUrl(asset.asset_image)} className="h-[460px] w-full rounded-2xl object-cover" alt={asset.title} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">Available Now</span>
          <h1 className="mt-4 text-4xl font-extrabold text-slate-900">{asset.title}</h1>
          <p className="mt-3 text-2xl font-bold text-teal-700">INR {asset.price_per_day} <span className="text-base font-normal text-slate-400">/ day</span></p>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-xl font-bold text-white">
              {asset.owner_details?.name?.[0] || "O"}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Trusted Owner</p>
              <p className="text-lg font-bold text-slate-900">{asset.owner_details?.name}</p>
              <p className="text-sm text-slate-500">Lending since {asset.owner_details?.joined}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-bold uppercase text-slate-400">Deposit</p>
              <p className="text-lg font-bold text-slate-800">INR {asset.deposit}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-bold uppercase text-slate-400">City / Area</p>
              <p className="text-lg font-bold text-slate-800">{asset.city || "Not Specified"}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Product Description</h3>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-600">{asset.description}</p>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">User Reviews</h3>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {avgRating ? (
                  <>
                    Average rating: <span className="font-extrabold text-slate-900">{avgRating}</span>/5 ({reviews.length}{" "}
                    {reviews.length === 1 ? "review" : "reviews"})
                  </>
                ) : (
                  "No reviews yet."
                )}
              </p>
            </div>
          </div>

          {reviewsLoading ? (
            <div className="mt-4 text-sm font-semibold text-slate-500">Loading reviews...</div>
          ) : reviews.length === 0 ? null : (
            <div className="mt-5 space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-slate-900">{r.reviewer_name || r.reviewer_email || "User"}</p>
                    <p className="text-sm font-black text-amber-600">
                      {"★".repeat(Number(r.rating) || 0)}
                      {"☆".repeat(5 - (Number(r.rating) || 0))}
                    </p>
                  </div>
                  {r.feedback ? (
                    <p className="mt-2 whitespace-pre-line text-sm font-semibold text-slate-600">{r.feedback}</p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-slate-400">No written feedback.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={handleChat} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500 bg-white px-5 py-3 font-semibold text-teal-700 hover:bg-teal-50">
            <MessageCircle size={16} />
            Chat with Owner
          </button>

          <button
            onClick={handleRentClick}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white shadow-lg shadow-emerald-200 ${
              canRent
                ? "bg-gradient-to-r from-teal-600 to-emerald-500"
                : "bg-slate-400"
            }`}
          >
            <ShieldCheck size={16} />
            {canRent ? "Proceed to Rent" : "Approval Required"}
          </button>
        </div>
        {!canRent && isAuthenticated && (
          <p className="text-sm font-semibold text-amber-700">
            You can browse products now, but renting is enabled only after admin approval.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
