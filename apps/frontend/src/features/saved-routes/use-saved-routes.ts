import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePreferenceStore } from "@/features/preferences/preference-store";
import { isPro } from "@/features/subscription/subscription-gate";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import { getDb } from "@/lib/db";
import {
  canSaveMoreRoutes,
  createSqliteSavedRoutesStore,
  type NewSavedRoute,
  type SavedRoute,
  type SavedRoutesStore,
  scheduleUndoableRemoval,
} from "./saved-routes-store";

// 9.1-9.6: the React-facing half of saved routes -- thin glue over
// saved-routes-store.ts's testable decision functions, matching
// use-paywall-gate.ts/use-feedback.ts's precedent of leaving hooks untested
// (this project's Vitest pipeline can't render/hook-test RN code; see
// mem:frontend/core) while the logic underneath is covered directly.
export function useSavedRoutes() {
  const router = useRouter();
  const paywallGate = usePaywallGate();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(
    new Set(),
  );
  const storeRef = useRef<SavedRoutesStore | null>(null);
  const undoHandlesRef = useRef<Map<string, { cancel: () => void }>>(new Map());

  const getStore = useCallback(async (): Promise<SavedRoutesStore> => {
    if (!storeRef.current) {
      storeRef.current = createSqliteSavedRoutesStore(await getDb());
    }
    return storeRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const store = await getStore();
    setRoutes(await store.list());
  }, [getStore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 9.2/9.3: only consult the Paywall gate once the free-limit decision says
  // this attempt needs Pro -- an allowed save never touches guard()/Paywall
  // at all.
  const saveRoute = useCallback(
    async (input: NewSavedRoute) => {
      if (!canSaveMoreRoutes(routes.length, isPro())) {
        paywallGate({ type: "saved_route_limit" });
        return;
      }
      const store = await getStore();
      await store.insert({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await refresh();
    },
    [routes.length, paywallGate, getStore, refresh],
  );

  // 9.6: hide the row immediately and only actually delete once the Undo
  // window elapses; undoRemove() cancels the pending timer instead.
  const removeRoute = useCallback(
    (id: string) => {
      setPendingRemovalIds((prev) => new Set(prev).add(id));
      const handle = scheduleUndoableRemoval(async () => {
        const store = await getStore();
        await store.remove(id);
        undoHandlesRef.current.delete(id);
        setPendingRemovalIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await refresh();
      });
      undoHandlesRef.current.set(id, handle);
    },
    [getStore, refresh],
  );

  const undoRemove = useCallback((id: string) => {
    undoHandlesRef.current.get(id)?.cancel();
    undoHandlesRef.current.delete(id);
    setPendingRemovalIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // 9.5: tapping a saved route runs an immediate search with its saved
  // conditions. use-route-search.ts's search reads comfort priority from the
  // global preference store (there's no per-request override), so the
  // saved route's own comfortPriority is applied there *before* navigating --
  // otherwise a route saved with a different priority than the user's
  // current live preference would silently search with the wrong one.
  const selectRoute = useCallback(
    (route: SavedRoute) => {
      usePreferenceStore
        .getState()
        .setPreference({ speedComfortBalance: route.comfortPriority });
      router.push({
        pathname: "/results",
        params: {
          fromStationId: route.fromStationId,
          toStationId: route.toStationId,
          departureTime: route.departureTime,
        },
      });
    },
    [router],
  );

  return {
    routes: routes.filter((route) => !pendingRemovalIds.has(route.id)),
    pendingRemovalIds,
    saveRoute,
    removeRoute,
    undoRemove,
    selectRoute,
  };
}
