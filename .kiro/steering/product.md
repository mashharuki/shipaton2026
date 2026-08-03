# Product Overview

`shipaton2026` is an early-stage monorepo for an entry in RevenueCat's **Shipaton** hackathon: build and ship a monetized mobile app within the hackathon window. The repo is currently at scaffold stage — a default Expo template frontend and a default Hono/Cloudflare Workers backend, wired together as a monorepo but without product-specific features yet. No PRD or feature spec exists yet under `.kiro/specs/`.

## Core Capabilities

- Cross-platform mobile client (iOS / Android / Web) via Expo + expo-router
- Edge API backend via Cloudflare Workers + Hono
- In-app monetization via RevenueCat — the intended core mechanic for the Shipaton submission, referenced throughout the project's tooling/skills but not yet integrated into either app's code

## Target Use Cases

- Ship a working, monetized mobile app before the Shipaton submission deadline
- Backend serves as the API/edge layer for the mobile client (exact responsibilities not yet defined — no routes beyond the template exist)

## Value Proposition

Not yet defined at the product level — the app's actual concept/idea has not been implemented. The stack choices favor hackathon speed: Cloudflare Workers for a near-zero-ops edge API, Expo for shipping iOS/Android/Web from one codebase.

---
_Update this file once the app's concept and feature scope are decided — this content should track the actual product, not the hackathon meta-goal, as soon as real features land._
