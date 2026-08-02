# Conventions

- Formatting/linting is Biome-only (`biome.json` at root, schema 2.5.6) — not ESLint/Prettier.
  Quote style: double quotes for JS/TS. Import organization is auto-applied
  (`assist.actions.source.organizeImports: on`) — don't hand-order imports, let Biome fix them.
  VCS-aware (`vcs.useIgnoreFile: true`) — respects `.gitignore`.
- Knip config (`knip.json`) uses tag-based ignore: mark intentionally-unused exports with a
  `// lintignore`-tagged comment convention (`tags: ["-lintignore"]`) rather than deleting or
  restructuring for knip's sake.
- Frontend file naming is kebab-case for components/hooks (`themed-text.tsx`, `use-color-scheme.ts`,
  `external-link.tsx`), not PascalCase filenames — matches existing `src/components/`, `src/hooks/`.
- Frontend has platform-specific file variants via Expo/Metro resolution: `*.web.tsx` overrides
  for web (e.g. `animated-icon.web.tsx`, `app-tabs.web.tsx`, `use-color-scheme.web.ts`) alongside
  the default (native) file — follow this pattern when adding platform-diverging components.
- Routing is Expo Router file-based under `apps/frontend/src/app/` (typed routes enabled) — add
  screens as files there, don't hand-roll a navigator.
- See also root `.claude/rules/code-style.md`, `.claude/rules/testing.md`,
  `.claude/rules/security.md`, `.claude/rules/git-workflow.md` for cross-cutting agent-facing
  conventions (TypeScript style, test naming/structure, security boundaries, branch/commit format)
  — these are enforced project instructions, read them directly when doing related work.
