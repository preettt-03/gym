import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "TRAINER" | "USER";
  isEmailVerified: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: AdminUser | null;
  hasHydrated: boolean;
  setSession: (accessToken: string, user: AdminUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

// Only the short-lived access token + user profile are persisted client-side.
// The refresh token lives exclusively in an httpOnly cookie set by the backend.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hasHydrated: false,
      setSession: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ accessToken: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "gym-admin-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
);
