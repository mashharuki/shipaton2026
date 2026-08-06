import { createAppError, ERROR_CODES, ERROR_MESSAGE_KEYS } from "shared";
import { describe, expect, it } from "vitest";

import { getErrorDisplayContent } from "@/lib/error-display";

describe("getErrorDisplayContent", () => {
  it("should show the offline message and offer a retry when the network is unreachable", () => {
    const content = getErrorDisplayContent(
      createAppError("offline", "Network request failed"),
    );

    expect(content.messageKey).toBe("errors.offline");
    expect(content.canRetry).toBe(true);
  });

  it("should show an understandable message and offer a retry when the server fails", () => {
    const content = getErrorDisplayContent(
      createAppError("http_error", "Request failed with status 500"),
    );

    expect(content.messageKey).toBe("errors.httpError");
    expect(content.canRetry).toBe(true);
  });

  it("should resolve a distinct, offerable-retry message for every ApiClient error code", () => {
    for (const code of ERROR_CODES) {
      const content = getErrorDisplayContent(createAppError(code, "x"));

      expect(content.messageKey).toBe(ERROR_MESSAGE_KEYS[code]);
      expect(content.canRetry).toBe(true);
    }
  });
});
