import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const isAuthorized = Boolean(accessToken) && user?.role === "ADMIN";

  useEffect(() => {
    if (hasHydrated && !isAuthorized) {
      navigate("/login", { replace: true });
    }
  }, [hasHydrated, isAuthorized, navigate]);

  if (!hasHydrated) return null;
  if (!isAuthorized) return null;
  return <>{children}</>;
}
