import { randomUUID } from "expo-crypto";
import {
  type ANALYTICS_EVENT_NAMES,
  type analyticsEventPropsSchema,
  postEventsResponseSchema,
} from "shared";
import type { z } from "zod";

import { apiRequest } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsEventProps = z.infer<typeof analyticsEventPropsSchema>;

type AnalyticsEvent = {
  name: AnalyticsEventName;
  props: AnalyticsEventProps;
  sessionId: string;
  occurredAt: string;
};

const MAX_BATCH_SIZE = 20;

// 17.1/17.2/17.4: buffers fired events and batch-sends them (<=20 per
// request, matching the backend's hard limit) via the shared collection
// endpoint. Common properties (plan type, prediction confidence, etc. --
// state that isn't known yet at 4.5's boundary, set later by the features
// that own it: 6.2's SubscriptionGate, 5.3's PredictionEngine) are merged
// into every event, with the event's own props taking precedence.
export function createAnalyticsClient() {
  const sessionId = randomUUID();
  let commonProps: AnalyticsEventProps = {};
  const buffer: AnalyticsEvent[] = [];

  function setCommonProps(props: Partial<AnalyticsEventProps>): void {
    commonProps = { ...commonProps, ...props };
  }

  function track(
    name: AnalyticsEventName,
    props: Partial<AnalyticsEventProps> = {},
  ): void {
    buffer.push({
      name,
      props: { ...commonProps, ...props },
      sessionId,
      occurredAt: new Date().toISOString(),
    });
    if (buffer.length >= MAX_BATCH_SIZE) {
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) {
      return;
    }
    // Reserved synchronously (before the first `await`) so a concurrent
    // track()-triggered auto-flush and a manual flush() call never grab the
    // same events -- each flush() call owns whatever was in the buffer at
    // its own synchronous entry point.
    const batch = buffer.splice(0, MAX_BATCH_SIZE);
    const result = await apiRequest(
      `${API_BASE_URL}/v1/events`,
      postEventsResponseSchema,
      { method: "POST", body: { events: batch } },
    );
    if (!result.ok) {
      // 失敗時再送: put the batch back for the next flush attempt. Known,
      // disclosed limitation (matches 3.5's Implementation Note): the
      // backend's per-event insert loop isn't transactional, so a
      // mid-batch failure can mean some events were already recorded --
      // a retry may resend them, causing duplicates. Fixing that requires
      // server-side dedup, out of this task's frontend-only boundary.
      buffer.unshift(...batch);
    }
  }

  return { track, flush, setCommonProps };
}

// 6.4: app-wide singleton (one sessionId per app session), same module-
// singleton pattern as query-client.ts's `queryClient`. First real consumer
// is 6.4's paywall_shown tracking (17.3); 4.5 only built the client itself.
export const analyticsClient = createAnalyticsClient();
