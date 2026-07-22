"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { googleLogin } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Google Identity Services attaches itself to window.google — no official
// types package for this script, so declare just what we use.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ onError }: { onError?: (message: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const data = await googleLogin(response.credential);
          setSession(data.accessToken, data.user);
          window.location.href = "/dashboard";
        } catch {
          onError?.("Google sign-in failed. Please try again.");
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }, [scriptLoaded, setSession, onError]);

  // Hidden entirely when not configured, rather than rendering a broken button.
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" async defer onLoad={() => setScriptLoaded(true)} />
      <div className="flex justify-center" ref={buttonRef} />
    </>
  );
}

// Divider + button together, hidden entirely when Google sign-in isn't
// configured so pages don't each need their own env check.
export function GoogleSignInSection({ onError }: { onError?: (message: string) => void }) {
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-foreground/10" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>
      <div className="mt-4">
        <GoogleSignInButton onError={onError} />
      </div>
    </div>
  );
}
