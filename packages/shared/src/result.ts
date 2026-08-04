export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; data: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}
