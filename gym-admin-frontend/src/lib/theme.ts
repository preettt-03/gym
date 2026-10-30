import { useSyncExternalStore } from "react";

// Same choices and storage key as the member site's next-themes setup. The
// inline script in index.html applies the stored theme before first paint.
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "theme";
const THEME_COLOR = { light: "#f6f5f1", dark: "#0a0a0a" } as const;
const systemQuery = window.matchMedia("(prefers-color-scheme: light)");
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "system" ? v : "dark";
}

function apply() {
  const choice = read();
  const resolved = choice === "system" ? (systemQuery.matches ? "light" : "dark") : choice;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
}

systemQuery.addEventListener("change", () => read() === "system" && apply());
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  apply();
  listeners.forEach((l) => l());
});

export function setTheme(choice: ThemeChoice) {
  localStorage.setItem(KEY, choice);
  apply();
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
  return { theme, setTheme };
}
