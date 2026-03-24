import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { connectSocket } from "../services/Socket";
import { ArrowRight, Leaf, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import AnimatedRentalIllustration from "../components/AnimatedRentalIllustration";
import Snowfall from "react-snowfall";
import api from "../api/axios";

import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase";

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const accessToken = localStorage.getItem("access");
    const currentIdentifiers = new Set(
      [
        localStorage.getItem("username"),
        localStorage.getItem("email"),
        localStorage.getItem("name"),
        localStorage.getItem("admin_email"),
      ]
        .filter(Boolean)
        .map((v) => v.toString().trim().toLowerCase())
        .filter(Boolean)
    );
    const isForCurrentUser = (payload) => {
      const recipient =
        payload?.data?.recipient_username ||
        payload?.data?.recipient ||
        payload?.data?.target_user ||
        payload?.data?.username ||
        "";

      if (!recipient) return true;
      if (currentIdentifiers.size === 0) return true;
      return currentIdentifiers.has(recipient.toString().trim().toLowerCase());
    };

    if (!isAuthenticated || !accessToken) return;

    connectSocket(accessToken);

    const setupFCM = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const fcmToken = await getToken(messaging, {
          vapidKey: "BLPdeSng1cHGdE7iqDN-E0QM8zORR55i-wwx8aSuTTVn7-su2vyYQ5WvueN1cn2MpBWEeErFL7Xu6o-ByHDygiI",
        });

        if (!fcmToken) return;

        await api.post("save-fcm-token/", { device_token: fcmToken });
      } catch (error) {
        console.error("FCM Flow Error:", error.response?.data || error.message);
      }
    };

    setupFCM();

    const audio = new Audio("/notification.mp3");

    const unsubscribe = onMessage(messaging, (payload) => {
      if (!isForCurrentUser(payload)) return;

      const eventType = payload?.data?.event_type;

      audio.play();

      switch (eventType) {
        case "RENT_REQUEST_CREATED":
          window.dispatchEvent(new Event("new_request"));
          window.dispatchEvent(new Event("new_notification"));
          window.dispatchEvent(new Event("realtime_update"));
          break;

        case "RENT_REQUEST_APPROVED":
          window.dispatchEvent(new Event("request_approved"));
          window.dispatchEvent(new Event("new_notification"));
          window.dispatchEvent(new Event("realtime_update"));
          break;

        case "RENT_REQUEST_REJECTED":
          window.dispatchEvent(new Event("request_rejected"));
          window.dispatchEvent(new Event("new_notification"));
          window.dispatchEvent(new Event("realtime_update"));
          break;

        default:
          window.dispatchEvent(new Event("new_notification"));
          window.dispatchEvent(new Event("realtime_update"));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  const handleDashboardClick = () => {
    if (isAuthenticated) {
      navigate("/my-rentals");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-10">
      <div className="pointer-events-none absolute left-[-80px] top-[-80px] h-52 w-52 rounded-full bg-teal-200/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] right-[-40px] h-72 w-72 rounded-full bg-orange-200/60 blur-3xl" />

      <section className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-2">
        <div className="fade-up">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-teal-700">
            <Sparkles size={14} />
            Sustainable Renting Platform
          </p>

          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-6xl">
            Premium Rentals.
            <br />
            Zero Ownership Waste.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
            Discover tools, appliances, electronics, and event equipment from trusted local owners.
            Rent fast, use responsibly, and return with ease.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleDashboardClick}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:from-teal-700 hover:to-emerald-600"
            >
              {isAuthenticated ? "Go to Dashboard" : "Login to Start"}
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => navigate("/products")}
              className="rounded-xl border border-teal-600 bg-white px-6 py-3 font-semibold text-teal-700 transition-all hover:bg-teal-50"
            >
              Explore Products
            </button>
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-900">1200+</p>
              <p className="text-xs font-semibold text-slate-500">Active Rentals</p>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-900">98%</p>
              <p className="text-xs font-semibold text-slate-500">Secure Returns</p>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-900">24/7</p>
              <p className="text-xs font-semibold text-slate-500">Support</p>
            </div>
          </div>
        </div>

        <div className="fade-up-delay relative">
          <div className="hero-grid absolute -inset-3 rounded-[30px] opacity-40" />
          <div className="glass float-soft relative overflow-hidden rounded-[28px] p-3">
            <AnimatedRentalIllustration />
          </div>
          <div className="glass absolute -bottom-6 -left-6 max-w-[260px] rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Top Categories</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">Cameras, Party Gear, Power Tools</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-[1200px] lg:hidden">
        <div className="glass overflow-hidden rounded-3xl p-3">
          <AnimatedRentalIllustration compact />
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-[1200px] gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-6">
          <Leaf className="text-emerald-600" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">Eco First</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Extend product lifespan and reduce waste through shared ownership.
          </p>
        </div>
        <div className="glass rounded-2xl p-6">
          <ShieldCheck className="text-teal-700" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">Secure & Verified</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Verified identities and protected booking flows make rentals safer.
          </p>
        </div>
        <div className="glass rounded-2xl p-6">
          <TimerReset className="text-orange-500" />
          <h3 className="mt-4 text-lg font-bold text-slate-900">Fast Checkout</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Discover, request, and confirm rentals in minutes from your dashboard.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
