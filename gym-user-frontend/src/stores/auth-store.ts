import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string | null;
  phone?: string | null;
  name: string | null;
  role: "ADMIN" | "TRAINER" | "USER";
  isEmailVerified: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

// Only the short-lived access token + user profile are persisted client-side.
// The refresh token lives exclusively in an httpOnly cookie set by the backend.
//
// `hasHydrated` matters: on a hard navigation, this store starts empty and only fills in
// from localStorage asynchronously. Consumers (e.g. RequireAuth) must wait for hydration
// before treating a null accessToken as "logged out" — otherwise an authenticated user gets
// bounced to /login for a frame while the persisted session is still loading.
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
      name: "gym-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
);
