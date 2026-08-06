import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { kvStore } from "@/lib/kv-store";

export const SPEED_COMFORT_BALANCES = ["speed", "balance", "comfort"] as const;
export type SpeedComfortBalance = (typeof SPEED_COMFORT_BALANCES)[number];

export const TOLERANCE_LEVELS = ["low", "medium", "high"] as const;
export type ToleranceLevel = (typeof TOLERANCE_LEVELS)[number];

// 2.4: 身体的事情の直接入力を求めず、移動上の希望（立ち時間・乗換・歩行の
// 許容度）として設定を受け付ける -- no field here maps to a physical/body
// attribute, only travel-preference tolerances.
export type ComfortPreference = {
  speedComfortBalance: SpeedComfortBalance;
  maxExtraMinutes: number;
  transferTolerance: ToleranceLevel;
  walkingTolerance: ToleranceLevel;
};

export const DEFAULT_PREFERENCE: ComfortPreference = {
  speedComfortBalance: "balance",
  maxExtraMinutes: 15,
  transferTolerance: "medium",
  walkingTolerance: "medium",
};

type PreferenceStore = {
  preference: ComfortPreference;
  setPreference: (patch: Partial<ComfortPreference>) => void;
};

// 2.1/2.2/2.4: persisted via the shared kv-store (lib/kv-store.ts) so a
// preference change survives app restarts, and is available immediately to
// whichever screen reads it next. Req 2.3's "次回以降の検索結果のルート順位
// へ変更を反映する" is an end-to-end outcome owned by task 5.4's RouteRanker
// (design.md's Components table assigns "3 案選定・プリファレンス反映" to
// RouteRanker, not PreferenceStore; the Requirements Traceability row for
// 2.1-2.4 is literally `ComfortPreference` 型 → RouteRanker) -- this store's
// job ends at correctly exposing the persisted, reactive value RouteRanker
// will consume once it (and RouteSearchEngine/PredictionEngine) exist.
export const usePreferenceStore = create<PreferenceStore>()(
  persist(
    (set) => ({
      preference: DEFAULT_PREFERENCE,
      setPreference: (patch) =>
        set((state) => ({ preference: { ...state.preference, ...patch } })),
    }),
    {
      name: "preferences",
      storage: createJSONStorage(() => kvStore),
    },
  ),
);
