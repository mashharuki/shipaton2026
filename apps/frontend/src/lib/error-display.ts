import type { AppError } from "shared";
import { getErrorMessageKey } from "shared";

export type ErrorDisplayContent = {
  messageKey: string;
  canRetry: boolean;
};

// 3.3/13.7/15.1/15.5: the decision (not the rendering) of what copy and
// retry affordance an ApiClient failure should surface -- kept as a pure
// function so it stays Vitest-testable per design.md's frontend Testing
// Strategy (domain layer only; `error-state.tsx` is the thin display layer
// that consumes this and is exercised by Playwright, not Vitest, per
// design.md's E2E scenario 4 -- react-native itself can't be imported under
// this project's Vitest/Vite pipeline, it fails to parse react-native's
// Flow syntax, confirmed by spike).
export function getErrorDisplayContent(error: AppError): ErrorDisplayContent {
  return {
    messageKey: getErrorMessageKey(error.code),
    canRetry: true,
  };
}
