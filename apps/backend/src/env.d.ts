// Secrets are never declared in wrangler.jsonc (set via `wrangler secret put`
// or a local, gitignored `.dev.vars` -- see .dev.vars.example), so `cf-typegen`
// never sees them and `CloudflareBindings` (worker-configuration.d.ts) doesn't
// include them. Merge them in here so `c.env` stays fully typed.
declare global {
  interface CloudflareBindings {
    ODPT_TOKEN: string;
    API_SHARED_KEY: string;
  }
}

export {};
