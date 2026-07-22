"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace("/login");
    }
  }, [hasHydrated, accessToken, router]);

  // Wait for the persisted session to load before deciding anything —
  // otherwise a hard navigation briefly looks logged-out and bounces to /login.
  if (!hasHydrated) return null;
  if (!accessToken) return null;
  return <>{children}</>;
}
