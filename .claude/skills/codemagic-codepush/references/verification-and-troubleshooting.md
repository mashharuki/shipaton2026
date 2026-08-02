# CodePush Debugging and Common Issues

## Verification Checklist

Run this before going to production:

1. Confirm the JS entry uses CodePush (default `codePush(App)` or an equivalent HOC / `sync()` setup)
2. Confirm server URL key is present:
   - iOS: `CodePushServerURL` in `Info.plist`
   - Android: `CodePushServerUrl` in `strings.xml`
3. Confirm deployment key is present for each platform
4. Release to `Staging` first
5. Install and launch app on device/simulator, verify update download/apply behaviour
6. Check deployment metrics:
```bash
code-push deployment ls MyApp-iOS
code-push deployment ls MyApp-Android
```
7. Promote to `Production` only after staging validation

---

## Debug Commands

```bash
code-push debug ios
code-push debug android  # requires ADB + connected device
```

Filter device logs by the `[CodePush]` prefix to isolate update events.

---

## Source Maps

When releasing a CodePush update, upload source maps to your crash reporting tool (Sentry, Datadog) so stack traces reference original code rather than minified bundles.

---

## Common Issues, Error Patterns, and Fixes

| Log / error pattern | Cause | Fix |
|---|---|---|
| `[CodePush] Checking for update` then silence / no install | `targetBinaryVersion` mismatch — device app version is outside the semver range | Re-release with correct `--targetBinaryVersion` (e.g. `~1.2.3`) matching the installed binary |
| `[CodePush] App is up to date` but customer expects an update | Update released to wrong deployment, or device has a different deployment key embedded | Verify deployment key in `Info.plist` / `strings.xml` matches the intended channel; run `code-push deployment list <app> -k` |
| App silently rolls back to previous version on next launch | `notifyAppReady()` was never called — CodePush assumes the update caused a crash | Add `codePush.notifyAppReady()` early in the app lifecycle in any custom sync flow |
| `[CodePush] Update failed to install` | Corrupted bundle, incompatible JS/native, or signing mismatch | Check if RSA signing is enabled — public key in app must match private key used to sign the release |
| `Error: Cannot find module '...'` after OTA update | Native module added in the update — CodePush cannot deliver native changes | Requires a new store binary; CodePush only updates JS and assets |
| `code-push release-react` fails with `not a React Native project` | Command run from wrong directory | Run from project root where `package.json` lives |
| `Invalid semver version` on release | `versionName` (Android `build.gradle`) or `CFBundleShortVersionString` (iOS `Info.plist`) is not valid semver | Fix to valid semver format e.g. `1.2.3` — do not use `1.0` or `1.0.0.0` |
| `Unauthorized` / `403` on CLI login or release | Access token expired or revoked | Customer can generate a new token self-service: Codemagic dashboard → **OTA Updates → Manage Access Keys → Generate key** |
| New release blocked: `Cannot publish updates when a rollout is in progress` | A partial rollout (< 100%) is still active on that deployment | Patch the existing rollout to 100% first: `code-push patch <app> Production --rollout 100`, then publish |
| `[CodePush] An update is available but it is not targeting the binary version of your app` | Device is on a binary version outside the `targetBinaryVersion` range | Release a new update with a broader semver range or one targeting the device's specific binary version |
| App keeps using bundled JS only — update downloads but never loads | Native bundle path not overridden in AppDelegate / MainApplication | Verify `CodePush.bundleURL()` (iOS) and `CodePush.getJSBundleFile()` (Android) are used in release path |
| Wrong deployment key or environment — update never appears | Deployment key in native config points to wrong channel | Run `code-push deployment ls <appName> -k` and rewire the exact key |
| Same app used for iOS and Android | Package incompatibility or failed installs | Split to separate app names per platform |
| `release-react` cannot detect versions — custom project structure | Explicit paths not provided | Pass `--plistFile`, `--gradleFile`, or set `--targetBinaryVersion` explicitly |
| OTA feels like a random restart or blank flash when returning from background | `checkFrequency`, `installMode`, or `minimumBackgroundDuration` not tuned for app usage pattern | Review sync options — see [Advanced: sync options](https://docs.codemagic.io/rn-codepush/advanced-sync-options/) |
| Update kicks users out of checkout, onboarding, or another critical flow | Update applies at an unsafe moment | Wrap fragile sections with `disallowRestart` / `allowRestart`, or defer to a safer install mode — see [Production control](https://docs.codemagic.io/rn-codepush/production-control/) |
| Optional updates rarely take effect on real devices | Optional installs wait for a full process restart; users seldom cold-start the app | Change check/install strategy or prompt for restart — see [Advanced: sync options](https://docs.codemagic.io/rn-codepush/advanced-sync-options/) |

---

## CLI Quick Reference

```bash
# Auth
code-push login --access-key $CODEPUSH_ACCESS_KEY

# App management
code-push app add MyApp-Android
code-push app add MyApp-iOS
code-push app list
code-push deployment list MyApp-Android -k

# Release
code-push release-react MyApp-Android android
code-push release-react MyApp-iOS ios
code-push release-react MyApp-Android android --deployment-name Production --rollout 10 --mandatory --targetBinaryVersion "~1.2.0"

# Promote / patch / rollback
code-push promote MyApp-Android Staging Production
code-push patch MyApp-Android Production --rollout 50
code-push rollback MyApp-Android Production

# Debug
code-push debug android
code-push debug ios
```

---

## Agent Decision Tree

### "The update is not reaching users / the app is not updating"

1. Did the customer release to the right deployment? Ask: did they use `--deployment-name Production` or are they still on Staging?
2. Is the deployment key in the native config correct? Run `code-push deployment list <app> -k` and compare against `Info.plist` / `strings.xml`.
3. Does the device's app version satisfy `targetBinaryVersion`? E.g. if binary is `1.3.0` and release targets `~1.2.0`, it will not be delivered.
4. Is there an active partial rollout? If < 100%, the user may simply not be in the rollout percentage. Check with `code-push deployment history <app> Production`.
5. Has enough time passed? The SDK checks on app launch by default — the user needs to restart the app.

---

### "The update applied but the app rolled back / is crashing"

1. Is `notifyAppReady()` being called? This is the most common cause. If the app restarts before `notifyAppReady()` runs, CodePush treats it as a failed update and reverts. Check for it in the codebase.
2. Does the update contain native code changes? CodePush cannot deliver those — the update will load but crash if it depends on a native module not in the binary.
3. Is RSA signing enabled? If the public key in the app doesn't match the private key used to sign the release, the update will be rejected at install time.
4. Check `[CodePush]` logs on device — look for `Update failed to install` or silent rollback messages.

---

### "The CLI is failing / authentication errors"

1. `Unauthorized` or `403` → token is expired or revoked. Customer can generate a new token self-service: Codemagic dashboard → **OTA Updates → Manage Access Keys → Generate key**.
2. `release-react` fails immediately → check they are running from the project root (where `package.json` is).
3. `Invalid semver` error on release → `versionName` in `build.gradle` (Android) or `CFBundleShortVersionString` in `Info.plist` (iOS) must be valid semver (`1.2.3`, not `1.0` or `1.0.0.0`).
4. `Cannot publish updates when a rollout is in progress` → patch the current rollout to 100% before publishing a new release.

---

### "Updates are applying but the wrong bundle loads"

1. Check that `AppDelegate` (iOS) or `MainApplication` (Android) was actually updated to use `CodePush.bundleURL()` / `CodePush.getJSBundleFile()`. If the original embedded bundle path is still there, CodePush updates are downloaded but never loaded.
2. Verify the correct deployment key is embedded — a Staging key in a Production build will pull Staging updates.

---

### "Analytics show high download count but low installs"

1. First check: is `notifyAppReady()` being called? High downloads + low successful installs is the classic symptom of a rollback loop.
2. Check failure count in OTA Updates dashboard — if failures are high, cross-reference with Sentry/Datadog using uploaded source maps to find the crash.
3. Check `targetBinaryVersion` — if too narrow, some devices download but fail compatibility check at install time.

---

## See Also

- [Debugging and common issues](https://docs.codemagic.io/rn-codepush/debugging-and-common-issues/) — native binary without CodePush SDK, wrong `targetBinaryVersion`, `notifyAppReady` when not using default `sync()`, source maps, filtered `[CodePush]` logs
- [Advanced sync options](https://docs.codemagic.io/rn-codepush/advanced-sync-options/)
- [Production control](https://docs.codemagic.io/rn-codepush/production-control/)
