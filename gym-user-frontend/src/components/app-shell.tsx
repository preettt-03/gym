"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CelebrationModal } from "@/components/leaderboard/celebration-modal";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * Page chrome. On desktop an open chat panel takes the right-hand column and
 * the page narrows beside it; on phones the panel covers the screen instead.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const chatOpen = useUiStore((s) => s.chatOpen);
  const reopenChat = useUiStore((s) => s.reopenChatAfterLogin);
  const accessToken = useAuthStore((s) => s.accessToken);
  // Reception TV screens: the page alone, no site chrome.
  const bare = usePathname().startsWith("/display");

  // A guest who tapped into chat lands back in it once they've signed in.
  useEffect(() => {
    if (accessToken && reopenChat) {
      useUiStore.setState({ reopenChatAfterLogin: false, chatOpen: true });
    }
  }, [accessToken, reopenChat]);

  if (bare) return <main className="flex-1">{children}</main>;

  return (
    <>
      <div className={cn("flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0", chatOpen && "lg:pr-[var(--chat-w)]")}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <MobileTabBar />
      <ChatPanel />
      <CelebrationModal />
    </>
  );
}
