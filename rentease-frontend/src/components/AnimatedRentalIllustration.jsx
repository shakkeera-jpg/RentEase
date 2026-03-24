import React from "react";
import { Package, ShoppingBag, Smartphone } from "lucide-react";

const variantConfig = {
  home: {
    leftTitle: "Camera Kit",
    rightTitle: "Tool Box",
    buttonText: "Confirm Rental",
  },
  login: {
    leftTitle: "Speaker Set",
    rightTitle: "Tripod Stand",
    buttonText: "Book Instantly",
  },
  register: {
    leftTitle: "Power Drill",
    rightTitle: "Event Lights",
    buttonText: "Reserve Now",
  },
};

const AnimatedRentalIllustration = ({ compact = false, variant = "home" }) => {
  const cfg = variantConfig[variant] || variantConfig.home;

  return (
    <div className={`relative ${compact ? "h-[320px]" : "h-[380px]"} w-full overflow-hidden rounded-2xl bg-gradient-to-br from-teal-100 via-emerald-50 to-orange-100`}>
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-teal-300/40 blur-2xl" />
      <div className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-orange-300/35 blur-2xl" />

      <div className="absolute left-1/2 top-1/2 w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-4 border-slate-900 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">RentEase</span>
          <Smartphone size={14} className="text-teal-600" />
        </div>

        <div className="space-y-2">
          <div className="rounded-lg bg-slate-100 p-2">
            <div className="mb-1 h-2 w-20 rounded bg-slate-300" />
            <div className="h-2 w-12 rounded bg-slate-200" />
          </div>
          <div className="rounded-lg bg-teal-50 p-2">
            <div className="mb-1 h-2 w-16 rounded bg-teal-300" />
            <div className="h-2 w-10 rounded bg-teal-200" />
          </div>
        </div>

        <button className="mt-3 w-full rounded-lg bg-gradient-to-r from-teal-600 to-emerald-500 py-1.5 text-[10px] font-bold text-white">
          {cfg.buttonText}
        </button>
      </div>

      <div className="absolute left-7 top-10 w-32 rounded-xl border border-white/70 bg-white/90 p-3 shadow-lg animate-pulse">
        <div className="mb-2 flex items-center gap-2">
          <Package size={14} className="text-teal-600" />
          <span className="text-[11px] font-bold text-slate-700">{cfg.leftTitle}</span>
        </div>
        <div className="h-1.5 w-14 rounded bg-slate-300" />
      </div>

      <div className="absolute bottom-10 right-8 w-36 rounded-xl border border-white/70 bg-white/90 p-3 shadow-lg animate-pulse">
        <div className="mb-2 flex items-center gap-2">
          <ShoppingBag size={14} className="text-orange-500" />
          <span className="text-[11px] font-bold text-slate-700">{cfg.rightTitle}</span>
        </div>
        <div className="h-1.5 w-20 rounded bg-slate-300" />
      </div>

      <div className="absolute left-1/2 top-[20%] h-2 w-2 -translate-x-1/2 rounded-full bg-teal-500 animate-ping" />
    </div>
  );
};

export default AnimatedRentalIllustration;
