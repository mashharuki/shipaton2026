import type { ZodType } from "zod";
import type { AppError } from "../errors/app-error";
import { createAppError } from "../errors/app-error";
import type { Result } from "../result";
import { err, ok } from "../result";

export function parseToResult<T>(
  schema: ZodType<T>,
  input: unknown,
): Result<T, AppError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  return err(createAppError("validation_error", message, parsed.error));
}
