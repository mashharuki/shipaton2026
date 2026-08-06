import { useMutation } from "@tanstack/react-query";
import { type feedbackPayloadSchema, okResponseSchema } from "shared";
import type { z } from "zod";

import { apiRequest } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

export type FeedbackOutcomeSelection =
  | { seatedOutcome: "seated_from_start" }
  | { seatedOutcome: "seated_from_middle"; seatedStationId: string }
  | { seatedOutcome: "stood_whole_trip" };

export type VsExpectedAnswer = FeedbackPayload["vsExpected"];

export type FeedbackContext = {
  tripId: string;
  railwayId: string;
  legKey: string;
  boardedAt: string;
};

// 7.3/8.1-8.6: builds exactly feedbackPayloadSchema's shape from the 3-outcome
// UI selection plus the two optional answers -- pure and Vitest-testable so
// the "no identifier/location field beyond the schema's own shape" and
// "optional field omitted, not sent as undefined" contracts (16.2, 16.4) are
// verified without a network call. Conditional spreads (not `field:
// value ?? undefined`) so an omitted optional answer is truly absent from
// the object, not merely `undefined`-valued.
export function buildFeedbackPayload(
  context: FeedbackContext,
  selection: FeedbackOutcomeSelection,
  vsExpected?: VsExpectedAnswer,
  predictedStandingMin?: number,
): FeedbackPayload {
  return {
    ...selection,
    tripId: context.tripId,
    railwayId: context.railwayId,
    legKey: context.legKey,
    boardedAt: context.boardedAt,
    ...(vsExpected ? { vsExpected } : {}),
    ...(predictedStandingMin !== undefined ? { predictedStandingMin } : {}),
  };
}

// 8.1-8.6: the send half -- a thin apiRequest wrapper (untested directly,
// same "thin hook" precedent as use-feedback's sibling hooks) so
// feedback.tsx only deals with mutate()/isPending/isError/isSuccess.
export function useFeedback() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) =>
      apiRequest(`${API_BASE_URL}/v1/feedback`, okResponseSchema, {
        method: "POST",
        body: payload,
      }),
  });
}
