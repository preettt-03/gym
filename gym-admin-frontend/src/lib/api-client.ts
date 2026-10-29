import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8004/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends the httpOnly refresh-token cookie
  // Gets the panel its own refresh cookie, separate from the member site's.
  headers: { "X-Client": "admin" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post<{ accessToken: string }>(
    `${API_URL}/auth/refresh`,
    {},
    { withCredentials: true, headers: { "X-Client": "admin" } }
  );
  useAuthStore.getState().setAccessToken(data.accessToken);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().clearSession();
      }
    }

    // A token that isn't an admin's (e.g. left over from before the panel had its
    // own cookie) can never succeed here — sign out instead of failing every page.
    if (error.response?.status === 403 && tokenRole(useAuthStore.getState().accessToken) !== "ADMIN") {
      useAuthStore.getState().clearSession();
    }

    return Promise.reject(error);
  }
);

function tokenRole(token: string | null): string | null {
  try {
    return token ? (JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null) : null;
  } catch {
    return null;
  }
}
