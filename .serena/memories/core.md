# shipaton2026 — Core Map

pnpm monorepo for a RevenueCat "Shipaton" hackathon entry. `pnpm-workspace.yaml` is present but
empty — packages are not wired via pnpm workspace globs; `apps/*` are managed as independent
package.json roots (each with its own lockfile-relevant deps hoisted into root `node_modules`).

Layout:
- `apps/frontend/` — Expo React Native app (iOS/Android/Web). See `mem:frontend/core`.
- `apps/backend/` — Cloudflare Workers API using Hono. See `mem:backend/core`.
- `packages/` — empty, reserved for shared packages.
- `data/` — empty, reserved.
- `docs/memo.md` — empty scratch file.
- Root tooling: Biome (lint+format, see `mem:conventions`), Knip (unused code/deps), pnpm.

Root has no test runner configured. No CI test step discovered under `.github/` beyond what's in
`mem:task_completion`.

Extensive `.claude/rules/*.md` govern agent behavior in this repo (code-style, git-workflow,
testing, security, argent mobile-device MCP tooling, dev/browser-tool priorities, learning-loop
memory policy). Those are process rules, not project facts — read them directly rather than via
Serena memory when relevant to the current task.

For commands: `mem:suggested_commands`. For completion checks: `mem:task_completion`.
