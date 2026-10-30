import { create } from "zustand";

interface UiState {
  chatOpen: boolean;
  menuOpen: boolean;
  /** A guest tried to chat; open the panel again once they're signed in. */
  reopenChatAfterLogin: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  setMenuOpen: (open: boolean) => void;
  setReopenChatAfterLogin: (value: boolean) => void;
}

// Shell state shared by the navbar, the mobile tab bar and the chat panel.
export const useUiStore = create<UiState>()((set) => ({
  chatOpen: false,
  menuOpen: false,
  reopenChatAfterLogin: false,
  openChat: () => set({ chatOpen: true, menuOpen: false }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen, menuOpen: false })),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setReopenChatAfterLogin: (reopenChatAfterLogin) => set({ reopenChatAfterLogin }),
}));
