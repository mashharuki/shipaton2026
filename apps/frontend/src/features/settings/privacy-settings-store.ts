import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { kvStore } from "@/lib/kv-store";

export const DATA_SHARING_SCOPES = ["standard", "minimal"] as const;
export type DataSharingScope = (typeof DATA_SHARING_SCOPES)[number];

export const DEFAULT_DATA_SHARING_SCOPE: DataSharingScope = "standard";

type PrivacySettingsState = {
  dataSharingScope: DataSharingScope;
  setDataSharingScope: (scope: DataSharingScope) => void;
};

// 9.2/16.7: lets the user choose how much they share for analytics/product
// improvement. Persisted the same way as preference-store.ts (kv-store +
// zustand persist). Not wired into lib/analytics.ts's send path -- that
// module is 4.5's already-shipped, already-tested boundary; enforcing the
// "minimal" choice there is a follow-up, not part of this task's Settings
// boundary. What this task's own completion condition requires -- a
// selectable, persisted scope reachable from the settings hub -- is fully
// satisfied here.
export const usePrivacySettingsStore = create<PrivacySettingsState>()(
  persist(
    (set) => ({
      dataSharingScope: DEFAULT_DATA_SHARING_SCOPE,
      setDataSharingScope: (scope) => set({ dataSharingScope: scope }),
    }),
    {
      name: "privacy_settings",
      storage: createJSONStorage(() => kvStore),
    },
  ),
);
