import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Pin timezone to Asia/Tokyo (JST) to catch timezone-dependent regressions
    // in nextWeekdayServiceDate. Under UTC, local date fields == UTC date fields,
    // so toISOString() would be indistinguishable from getFullYear/getMonth/getDate.
    // JST offset ensures tests fail if implementation switches to toISOString().
    env: { TZ: "Asia/Tokyo" },
  },
});
