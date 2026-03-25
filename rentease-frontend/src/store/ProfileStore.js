import { create } from "zustand";
import api from "../api/axios";

let inflightProfileRequest = null;

const useProfileStore = create((set, get) => ({
  profile: null,
  loading: false,
  hydrated: false,
  profilePhotoVersion: Date.now(),

  fetchProfile: async ({ force = false } = {}) => {
    const state = get();

    if (!force && state.hydrated && state.profile) {
      return state.profile;
    }

    if (inflightProfileRequest) {
      return inflightProfileRequest;
    }

    set({ loading: true });

    inflightProfileRequest = api
      .get("profile/")
      .then((res) => {
        set({ profile: res.data, loading: false, hydrated: true });
        return res.data;
      })
      .catch(() => {
        set({ loading: false, hydrated: true });
        return null;
      })
      .finally(() => {
        inflightProfileRequest = null;
      });

    return inflightProfileRequest;
  },

  updateBasicDetails: async (data) => {
    set({ loading: true });
    try {
      const hasProfilePhoto =
        data &&
        typeof data === "object" &&
        !(data instanceof FormData) &&
        (data.profile_photo instanceof File || data.profile_photo instanceof Blob);

      let payload = data;
      let config = undefined;

      if (hasProfilePhoto) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (value === undefined) return;
          if (value === null) {
            formData.append(key, "");
            return;
          }
          formData.append(key, value);
        });
        payload = formData;
        // Let the browser set multipart boundary automatically.
        config = undefined;
      }

      const res = await api.put("profile/", payload, config);
      const nextProfile = res?.data?.data ?? res?.data;

      set((state) => ({
        profile: nextProfile,
        loading: false,
        hydrated: true,
        profilePhotoVersion: hasProfilePhoto ? Date.now() : state.profilePhotoVersion,
      }));
      return { success: true };
    } catch (err) {
      set({ loading: false });
      return { success: false, error: err.response?.data };
    }
  },
  uploadID: async (file) => {
    const formData = new FormData();
    formData.append("id_document", file);
    try {
      await api.put("profile/verification/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await get().fetchProfile({ force: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data };
    }
  },

  resetProfile: () => set({ profile: null, loading: false, hydrated: false }),
}));

export default useProfileStore;
