import { describe, expect, it } from "vitest";
import { createAppError, isAppError, toAppError } from "./app-error";

describe("createAppError", () => {
  it("should omit cause when not provided", () => {
    const error = createAppError("timeout", "took too long");
    expect(error).toEqual({ code: "timeout", message: "took too long" });
  });

  it("should include cause when provided", () => {
    const cause = new Error("underlying");
    const error = createAppError("http_error", "request failed", cause);
    expect(error).toEqual({
      code: "http_error",
      message: "request failed",
      cause,
    });
  });
});

describe("isAppError", () => {
  it("should return true for a well-formed AppError", () => {
    expect(isAppError(createAppError("unknown", "oops"))).toBe(true);
  });

  it("should return false for a plain Error", () => {
    expect(isAppError(new Error("oops"))).toBe(false);
  });

  it("should return false when code is not a known error code", () => {
    expect(isAppError({ code: "not_a_real_code", message: "oops" })).toBe(
      false,
    );
  });

  it("should return false for null", () => {
    expect(isAppError(null)).toBe(false);
  });
});

describe("toAppError", () => {
  it("should pass through an existing AppError unchanged", () => {
    const error = createAppError("offline", "no network");
    expect(toAppError(error)).toBe(error);
  });

  it("should wrap a native Error as an unknown AppError", () => {
    const cause = new Error("native failure");
    const error = toAppError(cause);
    expect(error).toEqual({
      code: "unknown",
      message: "native failure",
      cause,
    });
  });

  it("should wrap an arbitrary thrown value as an unknown AppError", () => {
    const error = toAppError("string throw");
    expect(error).toEqual({
      code: "unknown",
      message: "Unknown error",
      cause: "string throw",
    });
  });
});
