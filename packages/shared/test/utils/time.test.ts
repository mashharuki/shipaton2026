import { describe, expect, it } from "vitest";
import { toDayType, toTimeBucket } from "../../src/utils/time";

describe("toTimeBucket", () => {
  it("should floor a time to the start of its 15-minute bucket", () => {
    expect(toTimeBucket(new Date(2026, 0, 5, 7, 0))).toBe("07:00");
    expect(toTimeBucket(new Date(2026, 0, 5, 7, 14))).toBe("07:00");
    expect(toTimeBucket(new Date(2026, 0, 5, 7, 15))).toBe("07:15");
    expect(toTimeBucket(new Date(2026, 0, 5, 7, 59))).toBe("07:45");
  });

  it("should zero-pad single-digit hours and minutes", () => {
    expect(toTimeBucket(new Date(2026, 0, 5, 5, 3))).toBe("05:00");
  });
});

describe("toDayType", () => {
  it("should classify Monday through Friday as weekday", () => {
    // 2026-01-05 is a Monday, 2026-01-09 is a Friday
    expect(toDayType(new Date(2026, 0, 5))).toBe("weekday");
    expect(toDayType(new Date(2026, 0, 9))).toBe("weekday");
  });

  it("should classify Saturday and Sunday as weekend", () => {
    expect(toDayType(new Date(2026, 0, 10))).toBe("weekend");
    expect(toDayType(new Date(2026, 0, 11))).toBe("weekend");
  });
});
