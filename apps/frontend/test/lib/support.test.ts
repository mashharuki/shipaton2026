import { describe, expect, it } from "vitest";

import { buildSupportMailtoUrl } from "@/lib/support";

describe("buildSupportMailtoUrl", () => {
  it("should build a mailto URL with an encoded subject", () => {
    expect(
      buildSupportMailtoUrl("support@example.com", "SeatSignal Support"),
    ).toBe("mailto:support@example.com?subject=SeatSignal%20Support");
  });

  it("should return null when no support address is configured", () => {
    expect(buildSupportMailtoUrl("", "SeatSignal Support")).toBeNull();
  });
});
