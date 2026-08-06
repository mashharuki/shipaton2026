import { describe, expect, it } from "vitest";

import { floorToTimeBucket, minutesOfDay } from "@/lib/clock-time";

describe("minutesOfDay", () => {
  it("should convert an HH:mm clock time to minutes elapsed since midnight", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("07:30")).toBe(450);
    expect(minutesOfDay("23:59")).toBe(1439);
  });
});

describe("floorToTimeBucket", () => {
  it("should floor a clock time down to the nearest 15-minute bucket", () => {
    expect(floorToTimeBucket("07:00")).toBe("07:00");
    expect(floorToTimeBucket("07:05")).toBe("07:00");
    expect(floorToTimeBucket("07:14")).toBe("07:00");
    expect(floorToTimeBucket("07:15")).toBe("07:15");
    expect(floorToTimeBucket("07:59")).toBe("07:45");
  });
});
