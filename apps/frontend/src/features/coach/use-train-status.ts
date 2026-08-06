import { useQuery } from "@tanstack/react-query";
import { trainStatusResponseSchema } from "shared";

import { apiRequest } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";

const POLL_INTERVAL_MS = 30000;

// 7.2/7.3: polls the backend's ODPT-proxy endpoint (3.2) while a coach
// session is active so Coach can react to delay/service changes without the
// rider needing to background/foreground the app. Returns a Result (never
// throws), same convention as every other apiRequest-backed hook -- a poll
// failure surfaces as `isErr(data)`, which use-coach-session.ts treats as
// "no new snapshot" (coach-session.ts's resolveDelayMinutes keeps the
// previous delay rather than resetting). Continues polling on a
// `stale: true` response rather than treating staleness as failure (7.4)
// since that's a normal 200 response, not a Result error.
export function useTrainStatus(railwayId: string | null) {
  return useQuery({
    queryKey: ["train-status", railwayId],
    enabled: railwayId !== null,
    refetchInterval: POLL_INTERVAL_MS,
    queryFn: () =>
      apiRequest(
        `${API_BASE_URL}/v1/train-status/${railwayId}`,
        trainStatusResponseSchema,
      ),
  });
}
