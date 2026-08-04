import { describe, expect, it } from "vitest";
import {
  analyticsEventSchema,
  postEventsRequestSchema,
} from "../../src/schemas/analytics-events";

describe("analyticsEventSchema", () => {
  const validEvent = {
    name: "route_selected",
    props: {
      railwayId: "RAIL_CHUO",
      timeBucket: "07:30",
      routeType: "comfort",
      diffFromFastestMinutes: 4,
    },
    sessionId: "1b6e1c7a-6e6a-4a9a-9a1a-2e6a7a8b9c0d",
    occurredAt: "2026-08-04T07:30:00.000Z",
  };

  it("should accept a representative event", () => {
    expect(analyticsEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("should accept an event with no properties", () => {
    const result = analyticsEventSchema.safeParse({ ...validEvent, props: {} });
    expect(result.success).toBe(true);
  });

  it("should reject an unknown event name", () => {
    const result = analyticsEventSchema.safeParse({
      ...validEvent,
      name: "app_opened",
    });
    expect(result.success).toBe(false);
  });

  it("should reject properties outside the defined vocabulary, such as precise coordinates", () => {
    const result = analyticsEventSchema.safeParse({
      ...validEvent,
      props: { ...validEvent.props, lat: 35.6, lng: 139.7 },
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid routeType", () => {
    const result = analyticsEventSchema.safeParse({
      ...validEvent,
      props: { ...validEvent.props, routeType: "shortest" },
    });
    expect(result.success).toBe(false);
  });
});

describe("postEventsRequestSchema", () => {
  it("should accept a batch of valid events", () => {
    const result = postEventsRequestSchema.safeParse({
      events: [
        {
          name: "onboarding_completed",
          props: {},
          sessionId: "1b6e1c7a-6e6a-4a9a-9a1a-2e6a7a8b9c0d",
          occurredAt: "2026-08-04T07:00:00.000Z",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject a batch containing a malformed event", () => {
    const result = postEventsRequestSchema.safeParse({
      events: [{ name: "onboarding_completed", props: {}, sessionId: "s1" }],
    });
    expect(result.success).toBe(false);
  });
});
