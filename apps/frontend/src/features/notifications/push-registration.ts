import { randomUUID } from "expo-crypto";
import * as Notifications from "expo-notifications";
import {
  type AppError,
  createAppError,
  err,
  isErr,
  ok,
  okResponseSchema,
  type Result,
  type WEEKDAYS,
} from "shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { apiRequest } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";
import { kvStore } from "@/lib/kv-store";

export type Weekday = (typeof WEEKDAYS)[number];

export type PushRegistrationSettings = {
  id: string;
  fromStationId: string;
  toStationId: string;
  weekdays: Weekday[];
  notifyAt: string;
  leadMinutes: number;
  locale: "ja" | "en";
};

export type DeepLinkParams = {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
};

type PushRegistrationState = {
  registration: PushRegistrationSettings | null;
  setRegistration: (registration: PushRegistrationSettings | null) => void;
};

// 10.1/10.5: the client's own record of what it registered server-side --
// needed both to render the frequency/time settings screen and (10.4) to
// recover departure-time context a tapped notification's payload doesn't
// carry (see resolveDeepLinkParams below, and push-sender.ts's payload which
// has no notifyAt field). Persisted the same way as
// preference-store.ts/usage-limiter.ts (kv-store + zustand persist).
export const usePushRegistrationStore = create<PushRegistrationState>()(
  persist(
    (set) => ({
      registration: null,
      setRegistration: (registration) => set({ registration }),
    }),
    {
      name: "push_registration",
      storage: createJSONStorage(() => kvStore),
    },
  ),
);

// 10.1: thin wrapper -- the "利用目的の事前説明" (pre-permission explanation)
// is the caller's job (an in-app dialog shown before this is invoked, see
// app/settings/notifications.tsx); this function only performs the actual
// OS-level permission request. Denial isn't an error case -- it's a valid
// outcome the caller renders, so this resolves to `ok(false)` rather than
// `err(...)`.
export async function requestNotificationPermission(): Promise<
  Result<boolean, AppError>
> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return ok(status === "granted");
  } catch (cause) {
    return err(
      createAppError(
        "unknown",
        "Failed to request notification permission",
        cause,
      ),
    );
  }
}

export async function getNotificationPermissionStatus(): Promise<
  Result<boolean, AppError>
> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return ok(status === "granted");
  } catch (cause) {
    return err(
      createAppError(
        "unknown",
        "Failed to read notification permission",
        cause,
      ),
    );
  }
}

async function getExpoPushToken(): Promise<Result<string, AppError>> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return ok(data);
  } catch (cause) {
    return err(createAppError("unknown", "Failed to obtain push token", cause));
  }
}

// 10.1-10.5: builds exactly PUT /v1/push-registrations/:id's body shape --
// pure and Vitest-testable so the request never silently drifts from
// pushRegistrationRequestSchema, same precedent as use-feedback.ts's
// buildFeedbackPayload.
export function buildPushRegistrationRequestBody(
  settings: Omit<PushRegistrationSettings, "id">,
  expoPushToken: string,
) {
  return {
    expoPushToken,
    fromStationId: settings.fromStationId,
    toStationId: settings.toStationId,
    weekdays: settings.weekdays,
    notifyAt: settings.notifyAt,
    leadMinutes: settings.leadMinutes,
    locale: settings.locale,
  };
}

// 10.1/10.2/10.5: fetches an Expo push token, PUTs the registration, and on
// success persists it locally (reused for both the create and the
// update-frequency/time path -- an existing local id is reused so this is an
// upsert, matching the backend route's own upsert semantics).
export async function registerPushNotification(
  settings: Omit<PushRegistrationSettings, "id">,
): Promise<Result<PushRegistrationSettings, AppError>> {
  const tokenResult = await getExpoPushToken();
  if (isErr(tokenResult)) {
    return tokenResult;
  }

  const existingId = usePushRegistrationStore.getState().registration?.id;
  const id = existingId ?? randomUUID();
  const body = buildPushRegistrationRequestBody(settings, tokenResult.data);

  const result = await apiRequest(
    `${API_BASE_URL}/v1/push-registrations/${id}`,
    okResponseSchema,
    { method: "PUT", body },
  );
  if (isErr(result)) {
    return result;
  }

  const registration: PushRegistrationSettings = { id, ...settings };
  usePushRegistrationStore.getState().setRegistration(registration);
  return ok(registration);
}

// 10.1: lets a user turn notifications back off without losing basic app
// function (the store's registration is cleared regardless of API outcome
// once the delete succeeds).
export async function unregisterPushNotification(): Promise<
  Result<void, AppError>
> {
  const existing = usePushRegistrationStore.getState().registration;
  if (!existing) {
    return ok(undefined);
  }

  const result = await apiRequest(
    `${API_BASE_URL}/v1/push-registrations/${existing.id}`,
    okResponseSchema,
    { method: "DELETE" },
  );
  if (isErr(result)) {
    return result;
  }

  usePushRegistrationStore.getState().setRegistration(null);
  return ok(undefined);
}

// 10.4: the tapped notification's own data payload (push-sender.ts's
// buildPushMessage) carries fromStationId/toStationId but no departure time
// -- notifyAt only exists in what the client itself registered. Pure and
// testable independent of the actual expo-notifications listener wiring
// below.
export function resolveDeepLinkParams(
  data: Record<string, unknown> | undefined,
  local: PushRegistrationSettings | null,
): DeepLinkParams | null {
  if (!local) {
    return null;
  }
  const fromStationId =
    typeof data?.fromStationId === "string"
      ? data.fromStationId
      : local.fromStationId;
  const toStationId =
    typeof data?.toStationId === "string"
      ? data.toStationId
      : local.toStationId;
  return { fromStationId, toStationId, departureTime: local.notifyAt };
}

// 10.4: wires the OS-level notification-tap event to `handler`. Untested
// glue around expo-notifications' own listener API -- same precedent as
// purchases-client.ts's addCustomerInfoListener (the branching/decision
// logic it depends on, resolveDeepLinkParams, is what's actually verified).
// This only fires for a tap while the JS runtime is already running -- see
// consumeLastNotificationDeepLink() for the cold-start case.
export function addNotificationTapListener(
  handler: (params: DeepLinkParams) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const local = usePushRegistrationStore.getState().registration;
      const params = resolveDeepLinkParams(data, local);
      if (params) {
        handler(params);
      }
    },
  );
  return () => subscription.remove();
}

// 10.4: a response that launched the app from a killed/backgrounded state is
// captured natively before addNotificationResponseReceivedListener can ever
// subscribe -- expo-notifications exposes it separately via
// getLastNotificationResponseAsync() for exactly this case (the same reason
// its own useLastNotificationResponse() hook checks this before relying on
// the live listener). Clears it after reading so a later remount/Fast
// Refresh doesn't re-navigate on the same stale response. Wrapped in
// try/catch: confirmed live in a browser that getLastNotificationResponseAsync
// throws ("...is not available on web") rather than resolving null on the
// Expo web target, which would otherwise crash the whole app at every
// startup via _layout.tsx's PushNotificationBoundary.
export async function consumeLastNotificationDeepLink(): Promise<DeepLinkParams | null> {
  let response: Awaited<
    ReturnType<typeof Notifications.getLastNotificationResponseAsync>
  >;
  try {
    response = await Notifications.getLastNotificationResponseAsync();
  } catch (cause) {
    console.warn("getLastNotificationResponseAsync unavailable", cause);
    return null;
  }
  if (!response) {
    return null;
  }
  await Notifications.clearLastNotificationResponseAsync().catch((cause) => {
    console.warn("Failed to clear last notification response", cause);
  });
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const local = usePushRegistrationStore.getState().registration;
  return resolveDeepLinkParams(data, local);
}
