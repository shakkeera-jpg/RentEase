import { create } from "zustand";
import api from "../api/axios";

const useProductStore = create((set, get) => ({
  products: [],
  ownerRequests: [],
  loading: false,

  fetchProducts: async (searchQuery = "", options = {}) => {
    const { silent = false } = options || {};
    if (!silent) set({ loading: true });
    try {
      const search = (searchQuery || "").trim();
      const res = await api.get("assets/", {
        params: search ? { search } : undefined,
      });
      set((state) => (silent ? { products: res.data } : { products: res.data, loading: false }));
    } catch (err) {
      if (!silent) set({ loading: false });
      console.error("Error fetching products", err);
      throw err;
    }
  },

  fetchOwnerRequests: async () => {
    try {
      const res = await api.get("owner/requests/");
      set({ ownerRequests: res.data });
    } catch (err) {
      console.error("Error fetching owner requests", err);
    }
  },

  manageRequest: async (bookingId, action) => {
    try {
      await api.post(`owner-action/${bookingId}/`, { action });

      set((state) => ({
        ownerRequests: state.ownerRequests.map(req =>
          req.id === bookingId ? { ...req, status: action === "approve" ? "APPROVED" : "REJECTED" } : req
        )
      }));
      alert(`Request ${action}ed successfully`);
    } catch (err) {
      alert(err.response?.data?.error || "Action failed");
    }
  },

  createBookingAndPayment: async (assetId, dates) => {
    try {
      // 1. Create the Booking entry (booking.urls)
      const bookingRes = await api.post("create/", { asset: assetId, ...dates });

      const bookingId = bookingRes.data.booking_id;

      // 2. Create Razorpay Order (payments.urls - uses 'payment/' prefix)
      const paymentRes = await api.post(`payment/create/${bookingId}/`, {});

      return {
        success: true,
        orderData: {
          id: paymentRes.data.order_id,
          amount: paymentRes.data.amount
        },
        bookingId: bookingId
      };
    } catch (err) {
      alert(err.response?.data?.error || "Booking failed");
      return { success: false };
    }
  },

  verifyPayment: async (paymentData) => {
    try {
      // Matches path('api/payment/', include('payments.urls')) -> path('verify/')
      await api.post("payment/verify/", paymentData);
      return true;
    } catch (err) {
      console.error("Verification failed", err);
      return false;
    }
  },

  finalizeBooking: async (bookingId, penalty) => {
    try {
      const res = await api.post(`finalize/${bookingId}/`, { penalty });

      // Update local state to hide the button after finalization
      set((state) => ({
        ownerRequests: state.ownerRequests.map(req =>
          req.id === bookingId ? { ...req, status: "COMPLETED" } : req
        )
      }));

      alert(res.data.message);
      return true;
    } catch (err) {
      alert(err.response?.data?.error || "Finalization failed");
      return false;
    }
  },

updateRenterStatus: async (bookingId, newStatus) => {
    try {
        await api.post(`update-status/${bookingId}/`, { status: newStatus });
        return true;
    } catch (err) {
        console.error("Status update failed:", err.response?.data);
        return false;
    }
},

  cancelBooking: async (bookingId) => {
    try {
      const res = await api.post(`cancel/${bookingId}/`, {});
      alert(res.data.message);
      return true;
    } catch (err) {
      alert(err.response?.data?.error || "Cancellation failed");
      return false;
    }
  }
}));

export default useProductStore;
