import { randomUUID } from "expo-crypto";
import { create } from "zustand";

import type { RouteLeg } from "@/features/search/route-search-engine";
import { analyticsClient } from "@/lib/analytics";

export type ActiveTrip = {
  tripId: string;
  legs: RouteLeg[];
  startedAt: string;
};

type CoachStoreState = { active: ActiveTrip | null };

// 7.1/7.3: transient (not persisted) "currently riding" state -- the
// completed record (with feedback, once the ride ends) is what 7.3's
// trip-history-repository.ts persists to SQLite. In-memory zustand only,
// same precedent as theme-store.ts for state that doesn't need to survive a
// restart.
const useCoachStore = create<CoachStoreState>(() => ({ active: null }));

export function startCoachSession(legs: RouteLeg[]): ActiveTrip {
  const trip: ActiveTrip = {
    tripId: randomUUID(),
    legs,
    startedAt: new Date().toISOString(),
  };
  useCoachStore.setState({ active: trip });
  analyticsClient.track("trip_started");
  return trip;
}

export function endCoachSession(): void {
  useCoachStore.setState({ active: null });
}

export function getActiveTrip(): ActiveTrip | null {
  return useCoachStore.getState().active;
}
