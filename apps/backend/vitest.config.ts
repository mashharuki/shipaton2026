import path from "node:path";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Absolute path (not CWD-relative): this config is evaluated by both vitest
// and knip's static analysis, which run from different working directories.
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "src/db/migrations"),
);

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          // Secrets are never in wrangler.jsonc/committed .dev.vars (gitignored,
          // developer-local) -- fix them here so tests are deterministic in CI.
          ODPT_TOKEN: "test-odpt-token",
          API_SHARED_KEY: "test-shared-key",
        },
      },
    }),
  ],
});
