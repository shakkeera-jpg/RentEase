import React, { useEffect, useState } from "react";
import useProductStore from "../store/ProductStore";
import api from "../api/axios";
import { resolveMediaUrl } from "../utils/mediaUrl";

const Bookings = () => {
  const { updateRenterStatus, cancelBooking } = useProductStore();
  const [rentals, setRentals] = useState([]);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchMyBookings = async () => {
    try {
      const res = await api.get("my-rentals");
      setRentals(res.data);
    } catch (err) {
      console.error("Error fetching bookings", err);
    }
  };

  useEffect(() => {
    fetchMyBookings();

    const refresh = () => fetchMyBookings();
    window.addEventListener("request_approved", refresh);
    window.addEventListener("request_rejected", refresh);
    window.addEventListener("realtime_update", refresh);
    window.addEventListener("new_notification", refresh);

    const intervalId = setInterval(refresh, 6000);

    return () => {
      window.removeEventListener("request_approved", refresh);
      window.removeEventListener("request_rejected", refresh);
      window.removeEventListener("realtime_update", refresh);
      window.removeEventListener("new_notification", refresh);
      clearInterval(intervalId);
    };
  }, []);

  const handleAction = async (booking, status) => {
    const success = await updateRenterStatus(booking.id, status);
    if (success) {
      fetchMyBookings();
      if (status === "RETURN_REQUESTED") {
        setReviewBooking(booking);
        setReviewRating(5);
        setReviewFeedback("");
      }
    }
  };

  const submitReview = async () => {
    if (!reviewBooking) return;
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) return alert("Please select a rating (1 to 5).");

    setReviewSubmitting(true);
    try {
      await api.post(`bookings/${reviewBooking.id}/review/`, {
        rating: reviewRating,
        feedback: reviewFeedback,
      });
      setReviewBooking(null);
      alert("Thanks! Your feedback was submitted.");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit feedback.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const canCancel = (booking) => {
    if (booking.status !== "OWNER_PENDING") return false;
    if (!booking.paid_at) return false;
    const paidAtMs = new Date(booking.paid_at).getTime();
    if (Number.isNaN(paidAtMs)) return false;
    return Date.now() - paidAtMs <= 24 * 60 * 60 * 1000;
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Cancel this order and refund the payment?")) return;
    const success = await cancelBooking(bookingId);
    if (success) fetchMyBookings();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold text-slate-900">My Orders</h1>

      {reviewBooking && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-slate-900">Rate this product</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{reviewBooking.asset_title}</p>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Rating</label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-teal-400"
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>
                      {v} {v === 1 ? "star" : "stars"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Feedback (optional)</label>
                <textarea
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-teal-400"
                  placeholder="Tell others about your experience..."
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                disabled={reviewSubmitting}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitReview}
                className="flex-1 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200"
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {rentals.map((item) => (
            <div key={item.id} className="glass flex flex-col justify-between gap-4 rounded-3xl p-5 md:flex-row md:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <img src={resolveMediaUrl(item.asset_image)} className="h-20 w-20 shrink-0 rounded-2xl object-cover" alt={item.asset_title} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-800">{item.asset_title}</h2>
                  <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-600">
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {canCancel(item) && (
                  <button
                    onClick={() => handleCancel(item.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm hover:bg-rose-100"
                  >
                    Cancel (Refund)
                  </button>
                )}

                {item.status === "APPROVED" && (
                  <button onClick={() => handleAction(item, "ACTIVE")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-100 hover:bg-blue-700">
                    Product Received
                  </button>
                )}

              {item.status === "ACTIVE" && (
                <button onClick={() => handleAction(item, "RETURN_REQUESTED")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black">
                  Product Returned
                </button>
              )}

              {item.status === "RETURNED" && <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">Waiting for owner to finalize...</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bookings;
