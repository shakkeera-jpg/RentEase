import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useProductStore from "../store/ProductStore";
import { CheckCircle2, CreditCard } from "lucide-react";
import { resolveMediaUrl } from "../utils/mediaUrl";
import useProfileStore from "../store/ProfileStore";
import { canPerformVerifiedActions } from "../utils/profileStatus";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpayCheckout = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { createBookingAndPayment, verifyPayment } = useProductStore();
  const { profile, fetchProfile, hydrated, loading: profileLoading } = useProfileStore();

  const { asset } = location.state || {};
  const [dates, setDates] = useState({ start_date: "", end_date: "" });
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!profile && !hydrated && !profileLoading) {
      fetchProfile();
    }
  }, [profile, hydrated, profileLoading, fetchProfile]);

  if (!asset) return <div className="p-20 text-center">Invalid session. <button onClick={() => navigate("/")}>Browse Products</button></div>;
  if (profile && !canPerformVerifiedActions(profile)) {
    return (
      <div className="p-20 text-center">
        Your account must be admin-approved before renting products.
        <button onClick={() => navigate("/profile")} className="ml-3 font-semibold text-teal-700">
          Go to profile
        </button>
      </div>
    );
  }

  const calculateDays = () => {
    if (!dates.start_date || !dates.end_date) return 0;
    const diff = new Date(dates.end_date) - new Date(dates.start_date);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const toInputDate = (value) => {
    if (!value) return "";
    return String(value).slice(0, 10);
  };

  const availabilityStart = toInputDate(
    asset?.availability?.[0]?.available_from || asset?.available_from
  );
  const availabilityEnd = toInputDate(
    asset?.availability?.[0]?.available_to || asset?.available_to
  );

  const hasAvailabilityWindow = Boolean(availabilityStart && availabilityEnd);

  const isWithinAvailability = () => {
    if (!hasAvailabilityWindow) return true;
    if (!dates.start_date || !dates.end_date) return false;

    return (
      dates.start_date >= availabilityStart &&
      dates.end_date <= availabilityEnd
    );
  };

  const totalRent = calculateDays() * asset.price_per_day;
  const grandTotal = totalRent + Number(asset.deposit);

  const handleProcessPayment = async () => {
    if (calculateDays() <= 0) {
      return alert("Please select a valid date range (End date must be after Start date).");
    }
    if (!isWithinAvailability()) {
      return alert("Please choose dates only within the owner's available rental period.");
    }

    if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
      alert("Razorpay key is missing in the frontend environment.");
      return;
    }

    setIsProcessing(true);

    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded || !window.Razorpay) {
        alert("Razorpay checkout failed to load. Please disable blockers and try again.");
        return;
      }

      const res = await createBookingAndPayment(asset.id, dates);
      if (!res.success) {
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: res.orderData.amount,
        currency: "INR",
        name: "RentEase Escrow",
        description: `Booking: ${asset.title}`,
        order_id: res.orderData.id,
        handler: async (response) => {
          const isVerified = await verifyPayment(response);
          if (isVerified) {
            setPaymentSuccess(true);
          } else {
            alert("Payment verification failed. Please contact support.");
          }
        },
        prefill: {
          name: "User Name",
          email: "user@example.com",
        },
        theme: { color: "#0f766e" },
        modal: {
          ondismiss: function () {
            console.log("Checkout form closed");
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setIsProcessing(false);
      });
      rzp.open();
    } catch (error) {
      console.error("Razorpay checkout failed to open", error);
      alert("Unable to open Razorpay checkout right now. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
      {paymentSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={32} />
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900">Request Sent</h2>
            <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              Your request has been sent to the owner. You should receive a response within 24 hours. If not approved in time,
              the payment is automatically refunded.
            </p>

            <button onClick={() => navigate("/products", { replace: true })} className="mt-6 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200">
              Back to Marketplace
            </button>
          </div>
        </div>
      )}

      <div className="glass space-y-6 rounded-3xl p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Payment</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Finalize Booking</h1>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Select Rental Dates</label>
          {hasAvailabilityWindow && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700">
              Owner available period: {availabilityStart} to {availabilityEnd}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              min={hasAvailabilityWindow ? availabilityStart : undefined}
              max={hasAvailabilityWindow ? (dates.end_date ? (dates.end_date < availabilityEnd ? dates.end_date : availabilityEnd) : availabilityEnd) : undefined}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
              onChange={(e) => setDates({ ...dates, start_date: e.target.value })}
            />
            <input
              type="date"
              min={hasAvailabilityWindow ? (dates.start_date || availabilityStart) : (dates.start_date || undefined)}
              max={hasAvailabilityWindow ? availabilityEnd : undefined}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
              onChange={(e) => setDates({ ...dates, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600"><span>Rent ({calculateDays()} days)</span><span className="font-semibold">INR {totalRent}</span></div>
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600"><span>Security Deposit</span><span className="font-semibold">INR {asset.deposit}</span></div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-extrabold text-teal-700"><span>Total Payable</span><span>INR {grandTotal}</span></div>
        </div>

        <button onClick={handleProcessPayment} disabled={isProcessing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
          <CreditCard size={16} />
          {isProcessing ? "Opening Razorpay..." : "Verify & Pay Now"}
        </button>
      </div>

      <div className="glass h-fit rounded-3xl p-5">
        <img src={resolveMediaUrl(asset.asset_image)} className="h-48 w-full rounded-2xl object-cover" alt={asset.title} />
        <h2 className="mt-4 text-xl font-bold text-slate-900">{asset.title}</h2>
        <p className="mt-1 text-sm text-slate-500">Lender: {asset.owner_details?.name}</p>
      </div>
    </div>
  );
};

export default Payment;
