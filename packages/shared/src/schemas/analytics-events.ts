import { z } from "zod";
import { timeBucketSchema } from "./dataset.schema";

export const ANALYTICS_EVENT_NAMES = [
  "onboarding_completed",
  "search_started",
  "search_completed",
  "route_selected",
  "trip_started",
  "feedback_submitted",
  "paywall_shown",
  "trial_started",
  "purchase_completed",
  "purchase_restored",
  "purchase_failed",
] as const;

export const analyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES).meta({
  description: "計測ファネルを構成するイベント名",
  example: "route_selected",
});

export const ROUTE_TYPES = ["fastest", "balanced", "comfort"] as const;
export const PLAN_TYPES = ["free", "pro"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const PAYWALL_TRIGGERS = [
  "search_limit",
  "pro_feature",
  "saved_route_limit",
] as const;

export const analyticsEventPropsSchema = z
  .strictObject({
    railwayId: z.string().min(1).optional(),
    timeBucket: timeBucketSchema.optional(),
    routeType: z.enum(ROUTE_TYPES).optional(),
    diffFromFastestMinutes: z.number().optional(),
    reducedStandingMinutes: z.number().optional(),
    planType: z.enum(PLAN_TYPES).optional(),
    confidence: z.enum(CONFIDENCE_LEVELS).optional(),
    paywallTrigger: z.enum(PAYWALL_TRIGGERS).optional(),
  })
  .meta({
    description:
      "イベントに付与する最小限のプロパティ（正確な位置情報・自宅/勤務先は含まない）",
    example: {
      railwayId: "RAIL_CHUO",
      timeBucket: "07:30",
      routeType: "comfort",
      planType: "free",
    },
  });

export const analyticsEventSchema = z
  .strictObject({
    name: analyticsEventNameSchema,
    props: analyticsEventPropsSchema,
    sessionId: z.string().min(1),
    occurredAt: z.iso.datetime(),
  })
  .meta({
    description: "分析イベント",
    example: {
      name: "route_selected",
      props: {
        railwayId: "RAIL_CHUO",
        timeBucket: "07:30",
        routeType: "comfort",
        diffFromFastestMinutes: 4,
      },
      sessionId: "1b6e1c7a-6e6a-4a9a-9a1a-2e6a7a8b9c0d",
      occurredAt: "2026-08-04T07:30:00.000Z",
    },
  });

export const postEventsRequestSchema = z
  .strictObject({
    events: z.array(analyticsEventSchema),
  })
  .meta({ description: "分析イベントのバッチ送信（最大 20 件）" });

export const postEventsResponseSchema = z
  .strictObject({
    accepted: z.number().int().nonnegative(),
  })
  .meta({ description: "受理したイベント件数", example: { accepted: 3 } });
