# CodePush Migrations

## Migrating from AppCenter CodePush

AppCenter CodePush was shut down in March 2025. Codemagic runs its own independent server at `codepush.pro` — nothing carries over from AppCenter. This is not a redirect or data import.

### What needs to change

**1. Swap the npm package** — [SDK install + app registration](https://docs.codemagic.io/rn-codepush/setup/#add-codepush-to-a-react-native-app)

```bash
npm uninstall react-native-code-push
npm install @code-push-next/react-native-code-push
cd ios && pod install && cd ..
```

Update all JS imports:
```javascript
// Before
import codePush from 'react-native-code-push';

// After
import codePush from '@code-push-next/react-native-code-push';
```

**2. Swap the CLI** — [CLI install + authentication](https://docs.codemagic.io/rn-codepush/setup/#install-and-configure-the-cli)

```bash
npm uninstall -g appcenter-cli
npm install -g @codemagic/code-push-cli
```

**3. Update the server URL in three places**

- `Info.plist` (iOS) — `CodePushServerURL` — [iOS native config](https://docs.codemagic.io/rn-codepush/setup/#codepush-ios-setup-react-native)
- `strings.xml` (Android) — `CodePushServerUrl` — [Android native config](https://docs.codemagic.io/rn-codepush/setup/#codepush-android-setup-react-native)
- CLI — `code-push login --access-key $CODEPUSH_TOKEN` — [Authenticate the CLI](https://docs.codemagic.io/rn-codepush/setup/#authenticate-the-cli)

> Run `code-push login` without a key to authenticate interactively instead.

**4. Re-register apps and get new deployment keys** — [Create a CodePush project](https://docs.codemagic.io/rn-codepush/setup/#create-a-codepush-project)

AppCenter apps and deployment keys do not exist on Codemagic's server. Start fresh:

```bash
code-push app add MyApp-iOS
code-push app add MyApp-Android
code-push deployment list MyApp-iOS -k
```

Update the new keys in `Info.plist` and `strings.xml`.

**5. Ship a new store binary** — [Run a test OTA release](https://docs.codemagic.io/rn-codepush/setup/#run-a-test-ota-release)

This is the critical step customers miss. Until a new binary containing the `codepush.pro` server URL and new deployment keys reaches users, existing installs will never receive OTA updates — the old AppCenter keys are permanently dead. There is no way to migrate existing users without a store release.

### Agent checklist for AppCenter migration tickets

When a customer says "CodePush stopped working" or "I migrated from AppCenter":

1. Are they still using `react-native-code-push` (old) or `@code-push-next/react-native-code-push` (new)?
2. Is the server URL `codepush.pro` in all three locations?
3. Have they re-registered their apps on Codemagic's server?
4. Have they shipped a new binary with the updated keys?
5. Do they understand users on old binaries are permanently cut off until that new binary reaches them?

---

## References

| Topic | Link |
|---|---|
| CLI install + authentication | https://docs.codemagic.io/rn-codepush/setup/#install-and-configure-the-cli |
| SDK install + app registration | https://docs.codemagic.io/rn-codepush/setup/#add-codepush-to-a-react-native-app |
| iOS native config (Info.plist + deployment key) | https://docs.codemagic.io/rn-codepush/setup/#codepush-ios-setup-react-native |
| Android native config (strings.xml + build.gradle) | https://docs.codemagic.io/rn-codepush/setup/#codepush-android-setup-react-native |
| Releasing updates (first OTA release) | https://docs.codemagic.io/rn-codepush/releasing-updates/ |