# CodePush Releasing Updates and Production Controls

## Standard Release Flow: Staging → Production

```bash
# Release to Staging first
code-push release-react MyApp-Android android --deployment-name Staging

# After testing, promote to Production
code-push promote MyApp-Android Staging Production
```

## Key Release Flags

| Flag | Purpose |
|---|---|
| `--deployment-name` | Target deployment (default: Staging) |
| `--targetBinaryVersion` | Semver range of native binaries this update is compatible with (e.g. `~1.2.0`) |
| `--mandatory` | Force install — users cannot skip |
| `--rollout <n>` | Gradual rollout to n% of users |
| `--description` | Release notes shown in update dialog |
| `--disabled` / `-x` | Release exists but is unavailable to users until explicitly enabled via `patch` |
| `--noDuplicateReleaseError` | Warn instead of error when releasing an identical bundle — useful in CI to avoid failing on no-op releases |
| `--privateKeyPath` | Path to code signing private key — required when update signing is enabled |
| `--development` | Build bundle in development mode (default: `false`) |
| `--sourcemapOutput` | Output path for the generated source map file |
| `--outputDir` | Custom temporary directory for bundled output |
| **Bundle entry** | |
| `--bundleName` | Custom name for the generated bundle file (inferred by default) |
| `--entryFile` | JavaScript entry point (default: platform-dependent, e.g. `index.ios.js`) |
| **Android** | |
| `--gradleFile` | Path to `build.gradle` (auto-detected by default) |
| **iOS** | |
| `--plistFile` | Path to `Info.plist` (auto-detected by default) |
| `--plistFilePrefix` | Prefix used when searching for the plist file |
| `--podFile` | Path to `Podfile` (auto-detected by default) |
| `--xcodeProjectFile` | Path to `.xcodeproj` file (auto-detected by default) |
| `--xcodeTargetName` | Xcode build target name (auto-detected by default) |
| `--buildConfigurationName` | Xcode build configuration name (auto-detected by default) |
| **Hermes** | |
| `--useHermes` | Enable Hermes engine for bundle compilation (platform-dependent default) |
| `--extraHermesFlags` | Additional flags passed to the Hermes compiler |

---

## Gradual Rollout

```bash
# Start at 25%
code-push release-react MyApp-Android android --rollout 25

# Increase without a new release
code-push patch MyApp-Android Production --rollout 50
```

**Constraints:**
- Only one active partial rollout per deployment
- Must reach 100% before publishing a new update to the same deployment

---

## Mandatory Updates

Use for security fixes, critical bugs, or breaking changes:

```bash
code-push release-react <app_name> <platform> --mandatory
# Or patch an existing release
code-push patch <app_name> Production --mandatory true
```

`mandatoryInstallMode` in the SDK controls when the mandatory update is actually applied.

---

## Manual Rollback

```bash
code-push rollback <app_name> <deployment_name>
```

**Automatic rollback:** If the app crashes before calling `notifyAppReady()`, CodePush reverts to the previous bundle automatically on next restart.
