import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useProductStore from "../store/ProductStore";
import { Search, ShieldCheck, Sparkles } from "lucide-react";
import { resolveMediaUrl } from "../utils/mediaUrl";

const Products = () => {
  const { products, fetchProducts, loading } = useProductStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const didMount = useRef(false);
  const searchRequestId = useRef(0);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++searchRequestId.current;
      setIsSearching(true);
      try {
        await fetchProducts(searchQuery, { silent: true });
      } finally {
        if (requestId === searchRequestId.current) setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [fetchProducts, searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 glass rounded-3xl p-6 md:p-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          <Sparkles size={14} />
          Marketplace
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">Available Assets</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
          Find verified items for short-term use. Book securely and coordinate directly with owners.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/85 p-4 shadow-lg shadow-slate-200/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            type="search"
            placeholder="Search by product name..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
          />
          {isSearching ? (
            <div
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
                searchQuery.trim() ? "right-14" : "right-3"
              }`}
            >
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600"></div>
            </div>
          ) : null}
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Clear
            </button>
          ) : null}
        </div>

        <p className="text-sm font-semibold text-slate-500">
          Results: <span className="font-extrabold text-slate-700">{products.length}</span>
        </p>
      </div>

      {loading && products.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-teal-600"></div>
        </div>
      ) : (
        <>
          {products.length === 0 ? (
            <div className="rounded-3xl border border-white/60 bg-white/85 p-10 text-center shadow-lg shadow-slate-200/40">
              <p className="text-sm font-bold text-slate-700">No products found.</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Try a different name.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`group overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-lg shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-xl ${
                    !p.is_available ? "opacity-80" : ""
                  }`}
                >
                  <div className="relative">
                    {!p.is_available && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
                        <span className="rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-600">
                          Unavailable / Pending
                        </span>
                      </div>
                    )}

                    <img
                      src={resolveMediaUrl(p.asset_image)}
                      className={`h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        !p.is_available ? "grayscale" : ""
                      }`}
                      alt={p.title}
                    />
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-base font-bold text-slate-900">{p.title}</h3>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">#{p.id}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`${p.is_available ? "text-teal-700" : "text-slate-400"} text-lg font-extrabold`}>
                        INR {p.price_per_day}/day
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <ShieldCheck size={13} />
                        Verified
                      </span>
                    </div>

                    <button
                      onClick={() => navigate(`/product/${p.id}`)}
                      disabled={!p.is_available}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        p.is_available
                          ? "bg-slate-900 text-white hover:bg-black"
                          : "cursor-not-allowed bg-slate-200 text-slate-400"
                      }`}
                    >
                      <Search size={14} />
                      {p.is_available ? "View Details" : "Locked"}
                    </button>

                    {!p.is_available && (
                      <p className="text-[11px] font-semibold text-rose-500">This item is currently awaiting owner approval.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Products;
