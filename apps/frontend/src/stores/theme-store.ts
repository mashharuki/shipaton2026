import { create } from "zustand";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

type ThemeStore = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

// In-memory only for now (14.2's toggle just needs to work live) -- no
// kv-store abstraction exists yet in this codebase to persist it across
// restarts. Revisit once one lands (4.3's SQLite work, or 9.2's settings
// hub, whichever builds it first).
export const useThemeStore = create<ThemeStore>((set) => ({
  preference: "system",
  setPreference: (preference) => set({ preference }),
}));
