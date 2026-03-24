
import { create } from "zustand";
import api from "../api/axios";

const useAssetStore = create((set) => ({
  myAssets: [],
  loading: false,
  error: null,

  fetchMyAssets: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("my-assets/");
      set({ myAssets: res.data, loading: false });
    } catch (err) {
      set({ error: "Failed to load your assets", loading: false });
    }
  },

  addAsset: async (assetData) => {
    set({ loading: true });
    try {
      const res = await api.post("my-assets/", assetData);
      set((state) => ({ 
        myAssets: [...state.myAssets, res.data], 
        loading: false 
      }));
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.detail || "Verification required to post.";
      set({ error: msg, loading: false });
      return { success: false, error: msg };
    }
  },

  deleteAsset: async (id) => {
    try {
      await api.delete(`my-assets/${id}/`);
      set((state) => ({
        myAssets: state.myAssets.filter((a) => a.id !== id)
      }));
    } catch (err) {
      alert("Could not delete asset.");
    }
  }
}));

export default useAssetStore;