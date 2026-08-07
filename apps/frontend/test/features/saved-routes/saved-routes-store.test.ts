import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canSaveMoreRoutes,
  scheduleUndoableRemoval,
  UNDO_WINDOW_MS,
} from "@/features/saved-routes/saved-routes-store";

describe("canSaveMoreRoutes", () => {
  it("should allow a free user with no saved routes to save one", () => {
    expect(canSaveMoreRoutes(0, false)).toBe(true);
  });

  it("should block a free user's 2nd save attempt", () => {
    expect(canSaveMoreRoutes(1, false)).toBe(false);
  });

  it("should always allow a Pro user regardless of how many routes are saved", () => {
    expect(canSaveMoreRoutes(5, true)).toBe(true);
  });
});

describe("scheduleUndoableRemoval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should commit the removal once the undo window elapses", () => {
    const commit = vi.fn();
    scheduleUndoableRemoval(commit, UNDO_WINDOW_MS);

    vi.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(commit).toHaveBeenCalledOnce();
  });

  it("should not commit when cancelled before the undo window elapses", () => {
    const commit = vi.fn();
    const { cancel } = scheduleUndoableRemoval(commit, UNDO_WINDOW_MS);

    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    cancel();
    vi.advanceTimersByTime(10);

    expect(commit).not.toHaveBeenCalled();
  });
});
