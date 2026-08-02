# CodePush Core Concepts

## What CodePush Is

CodePush is Codemagic's over-the-air (OTA) update service for React Native apps. It allows teams to push JavaScript bundle and asset updates directly to users without going through the App Store or Google Play.

**Server URL:** `https://codepush.pro/`
**CLI package:** `@codemagic/code-push-cli`
**SDK package:** `@code-push-next/react-native-code-push`

---

## What Can and Cannot Be Updated

| Can update via CodePush | Requires a new binary (store release) |
|---|---|
| JavaScript bugs and logic | Native module changes |
| UI, styling, layout | React Native version upgrades |
| Bundled assets (images, fonts) | Native config changes (permissions, entitlements) |
| Feature flags | Platform-specific native features |
| Performance improvements | |

**Key rule:** If the change touches native code (Swift, Kotlin, Xcode config, Gradle), CodePush cannot deliver it — a new store binary is required.

---

## Key Terms

- **App**: Registered per platform (`MyApp-Android`, `MyApp-iOS`). Keep platforms separate — never use a single app for both.
- **Deployment**: A release channel within an app. Default deployments are `Staging` and `Production`. Additional ones can be created.
- **Deployment key**: Embedded in the mobile binary at build time; directs the SDK to the correct deployment channel.
- **Update**: A JavaScript bundle + assets released to a deployment. Versioned and tied to a `targetBinaryVersion` range.
- **Delta update**: CodePush delivers only the changed files, not the full bundle — reduces download size for users.

---

## How Updates Reach Users

1. App launches → SDK checks CodePush server for updates
2. If available, bundle is downloaded and stored locally
3. Update applied on restart / resume / immediately (configurable via `InstallMode`)
4. If the update crashes before calling `notifyAppReady()`, CodePush auto-reverts to the previous bundle

---

## Analytics

Accessed via Codemagic dashboard → **OTA Updates**.

| Metric | What it tells you |
|---|---|
| Downloads | How many devices received the bundle |
| Successful installs | How many applied it successfully |
| Failed installs | Installation errors — investigate if high |
| Rollout adoption | How update is spreading during gradual rollout |

**Data updates hourly.**

High downloads + low installs = likely installation failure or SDK misconfiguration. Check `notifyAppReady()` call and `targetBinaryVersion` compatibility.
