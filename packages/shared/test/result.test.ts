import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok } from "../src/result";

describe("ok", () => {
  it("should produce a successful result when given data", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, data: 42 });
  });
});

describe("err", () => {
  it("should produce a failed result when given an error", () => {
    const result = err("boom");
    expect(result).toEqual({ ok: false, error: "boom" });
  });
});

describe("isOk", () => {
  it("should return true when the result is successful", () => {
    expect(isOk(ok(1))).toBe(true);
  });

  it("should return false when the result is a failure", () => {
    expect(isOk(err("boom"))).toBe(false);
  });
});

describe("isErr", () => {
  it("should return true when the result is a failure", () => {
    expect(isErr(err("boom"))).toBe(true);
  });

  it("should return false when the result is successful", () => {
    expect(isErr(ok(1))).toBe(false);
  });
});
