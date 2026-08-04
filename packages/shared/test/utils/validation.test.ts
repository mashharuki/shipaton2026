import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isAppError } from "../../src/errors/app-error";
import { isErr, isOk } from "../../src/result";
import { parseToResult } from "../../src/utils/validation";

const schema = z.object({ name: z.string(), age: z.number() });

describe("parseToResult", () => {
  it("should return an ok Result with the parsed data on success", () => {
    const result = parseToResult(schema, { name: "Alice", age: 30 });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("should return an err Result with a validation AppError on failure", () => {
    const result = parseToResult(schema, {
      name: "Alice",
      age: "not a number",
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isAppError(result.error)).toBe(true);
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("should reject unknown fields when the schema is strict", () => {
    const strictSchema = z.strictObject({ name: z.string() });
    const result = parseToResult(strictSchema, {
      name: "Alice",
      extra: "field",
    });
    expect(isErr(result)).toBe(true);
  });
});
