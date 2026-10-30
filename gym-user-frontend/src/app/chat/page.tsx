"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/stores/ui-store";

// Chat lives in the side panel now; old /chat links open it over the home page.
export default function ChatPage() {
  const router = useRouter();
  const openChat = useUiStore((s) => s.openChat);

  useEffect(() => {
    openChat();
    router.replace("/");
  }, [openChat, router]);

  return null;
}
