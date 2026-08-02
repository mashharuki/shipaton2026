# Codemagic CodePush Setup

Set up and maintain OTA update delivery for React Native apps through Codemagic-hosted CodePush (`https://codepush.pro`) across iOS and Android. 

## Official documentation (Codemagic)

Use these as the maintained source of truth (read the relevant page when the task touches that area):

- [Concepts](https://docs.codemagic.io/rn-codepush/concepts/) — "JS vs native, delta updates, SDK-in-binary prerequisite"
- [Setup](https://docs.codemagic.io/rn-codepush/setup/) — "CLI login, first `release-react`, RN integration overview"
- [Releasing updates](https://docs.codemagic.io/rn-codepush/releasing-updates/) — "Staging → promote, `targetBinaryVersion`, semver"
- [Production control](https://docs.codemagic.io/rn-codepush/production-control/) — "Rollouts, mandatory, rollback, mandatory propagation"
- [Security and access](https://docs.codemagic.io/rn-codepush/security-and-access/) — "Access keys, package signing"
- [CI integration](https://docs.codemagic.io/rn-codepush/ci-integration/) — "Codemagic/GitHub Actions release patterns"
- [Issues and debugging](https://docs.codemagic.io/rn-codepush/debugging-and-common-issues/) — "`code-push debug`, logs, `notifyAppReady`, source maps"
- [CodePush analytics](https://docs.codemagic.io/rn-codepush/codepush-analytics/) — "Dashboard and CLI metrics (path is `codepush-analytics`, not `analytics`)"
- [CLI quick reference](https://docs.codemagic.io/rn-codepush/cli-quick-reference/) — "Common `code-push` flags"
- [Advanced: sync options](https://docs.codemagic.io/rn-codepush/advanced-sync-options/) — "Client UX, `sync()`, install modes, dialogs, progress, restarts"

## Expected Output

Produce an implementation plan and then concrete edits/commands that include:

1. Native and JS integration steps for each requested platform.
2. Copy-paste snippets for exact files (`Info.plist`, `strings.xml`, `AppDelegate`, `MainApplication.kt`, `codemagic.yaml`).
3. CodePush app/deployment commands referencing deployment keys via environment variables or placeholders only — never output actual key values verbatim.
4. A release, verification, and rollback path.

## Workflow

1. Confirm scope and prerequisites.
2. Configure React Native client integration (JS + native).
3. Configure Codemagic CI and CodePush CLI auth.
4. Create platform apps/deployments and wire deployment keys.
5. Validate OTA on `Staging`, ship a store binary that includes CodePush for production users, then promote OTA from `Staging` to `Production` (see Step 4).
6. Troubleshoot or rollback if verification fails.

## Step 1: Confirm Scope And Prerequisites

Do the following first:

1. Confirm the project is React Native (pure Expo managed workflow is not supported by the plugin setup).
2. Confirm Codemagic has provisioned a CodePush access token for the team (self-service: **OTA Updates → Manage Access Keys → Generate key**).
3. Confirm whether the user wants setup for both platforms or only one.
4. Use separate CodePush app names per platform (for example `MyApp-iOS`, `MyApp-Android`).

If prerequisites are missing, stop and list what is needed.

## Step 2: Configure React Native Client Integration

1. Install plugin dependency:
   - `yarn add @code-push-next/react-native-code-push`
2. Wrap the app root component:
   - `import codePush from "@code-push-next/react-native-code-push";`
   - `export default codePush(App);`
3. Apply platform-native wiring:
   - iOS details: [references/setup-ios.md](references/setup-ios.md)
   - Android details: [references/setup-android.md](references/setup-android.md)

Always set both server URL and deployment key in native config:

1. iOS `Info.plist` keys: `CodePushServerURL`, `CodePushDeploymentKey`
2. Android `strings.xml` keys: `CodePushServerUrl`, `CodePushDeploymentKey`

## Step 3: Configure Codemagic CI + CLI

Follow [references/codepush-releases-codemagic-ci.md](references/codepush-releases-codemagic-ci.md) and [references/codepush-cli.md](references/codepush-cli.md) to ensure:

1. `@codemagic/code-push-cli` is installed in workflow scripts.
2. Login uses Codemagic server URL and token from environment variables.
3. Release commands target explicit platform app names and deployment channels.

Use [https://github.com/codemagic-ci-cd/code-push-pro](https://github.com/codemagic-ci-cd/code-push-pro) for CLI reference and ensure all commands align with the current CLI behavior, calling out any discrepancies from project docs.

## Step 4: Verify End-To-End

Follow [references/verification-and-troubleshooting.md](references/verification-and-troubleshooting.md):

1. Build and install a native binary that includes the CodePush SDK and your **Staging** deployment key (internal / QA build is enough to exercise OTA).
2. Release an OTA update to **Staging** and confirm the device picks it up.
3. Validate behavior and metrics on **Staging** before any Production promotion.
4. **Optional:** Tune install/check timing or dialogs for how users use the app ([Advanced: sync options](https://docs.codemagic.io/rn-codepush/advanced-sync-options/)), then test in staging again.
5. Ship a **store** release (App Store / Google Play) so production users run a binary that already contains CodePush; wait until installs matter for your rollout.
6. Promote the tested OTA from **Staging** to **Production** in CodePush so eligible store binaries receive the JS update.

## Execution Rules

1. Prefer exact file edits and commands over abstract guidance.
2. Keep platform differences explicit; never merge iOS and Android deployment keys.
3. Use long-form CLI flags when ambiguity exists (for example `--targetBinaryVersion`).
4. If a command in project docs differs from CLI docs, call out the difference and choose the current CLI behavior.
5. Never output actual credential values (deployment keys, access tokens, or server secrets) verbatim. Always use environment variable references (e.g., `$CODEPUSH_TOKEN`) or explicit placeholders (e.g., `YOUR_DEPLOYMENT_KEY`). Direct users to retrieve real values from Codemagic's secure environment variables, not from model output.
6. Always ensure `notifyAppReady()` is called early in the app lifecycle — omitting it causes CodePush to treat the update as failed and silently roll back.
7. CodePush delivers JS bundles and assets only — native code changes require a new store binary.

## Reference Files

| Topic | File |
|---|---|
| What CodePush is, core concepts, analytics | [codepush-core-concepts.md](references/codepush-core-concepts.md) |
| JS SDK setup, root component wrap, notifyAppReady, sync options | [codepush-js-sdk.md](references/codepush-js-sdk.md) |
| iOS native setup | [setup-ios.md](references/setup-ios.md) |
| Android native setup | [setup-android.md](references/setup-android.md) |
| CLI commands, auth, app/deployment management | [codepush-cli.md](references/codepush-cli.md) |
| Releasing, promoting, rollouts, rollbacks | [codepush-releases.md](references/codepush-releases.md) |
| CI integration with Codemagic YAML | [codepush-ci-integration.md](references/codepush-ci-integration.md) |
| Access tokens, RSA signing | [codepush-security.md](references/codepush-security.md) |
| Migrating from AppCenter | [codepush-migrations.md](references/codepush-migrations.md) |
| Debugging, error patterns, decision trees | [codepush-debugging.md](references/verification-and-troubleshooting.md) |
