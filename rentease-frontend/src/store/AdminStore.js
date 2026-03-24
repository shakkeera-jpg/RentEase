import { create } from "zustand";
import api from "../api/axios";

const useAdminStore = create((set) => ({
  pendingList: [],
  loading: false,

  fetchPending: async () => {
    set({ loading: true });
    try {
      const res = await api.get("pending/");
      set({ pendingList: res.data, loading: false });
    } catch (err) {
      set({ loading: false });
    }
  },

  processVerification: async (id, status, reason = "") => {
    try {
      await api.post(`action/${id}/`, {
        status: status,
        rejection_reason: reason
      });
      set((state) => ({
        pendingList: state.pendingList.filter((item) => item.id !== id)
      }));
      return true;
    } catch (err) {
      return false;
    }
  }
}));

export default useAdminStore;