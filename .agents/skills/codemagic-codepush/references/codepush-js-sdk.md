# CodePush JS SDK Integration

## Install the SDK

```bash
npm install @code-push-next/react-native-code-push
```

---

## Wrap Root Component

**Basic setup — default behaviour (check on app start, install on next restart):**
```javascript
import codePush from '@code-push-next/react-native-code-push';

function App() { /* ... */ }
export default codePush(App);
```

**With custom sync options:**
```javascript
import codePush, { InstallMode } from '@code-push-next/react-native-code-push';

const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
  installMode: InstallMode.ON_NEXT_RESUME,
  minimumBackgroundDuration: 60, // only restart if backgrounded for 60+ seconds
};

function App() { /* ... */ }
export default codePush(codePushOptions)(App);
```

**Custom sync() flow** — use when you need control over when the check happens (e.g. after login, on a button tap):
```javascript
import codePush from '@code-push-next/react-native-code-push';

async function checkForUpdate() {
  const update = await codePush.checkForUpdate();
  if (update) {
    await update.download();
    await update.install(codePush.InstallMode.ON_NEXT_RESTART);
  }
}
```

---

## notifyAppReady()

REQUIRED in any custom flow that does not use the default `codePush(App)` wrapper. Call it after the bundle has loaded successfully. If it is never called, CodePush treats the update as crashed and rolls back on next restart:

```javascript
import codePush from '@code-push-next/react-native-code-push';

// Call this once the app is ready — e.g. in useEffect on the root component
codePush.notifyAppReady();
```

> `notifyAppReady()` is called automatically when using `codePush(App)`. Only add it manually in custom `sync()` flows.

---

## Advanced Sync Options

For customers using custom `sync()` flows instead of the default `codePush(App)` wrapper:

| Option | Description |
|---|---|
| `InstallMode.ON_NEXT_RESTART` | Apply on full restart (default for optional) |
| `InstallMode.ON_NEXT_RESUME` | Apply when app returns from background |
| `InstallMode.IMMEDIATE` | Apply immediately |
| `minimumBackgroundDuration` | Minimum seconds in background before resume-trigger fires |
| `mandatoryInstallMode` | Controls timing of mandatory update installation |
| `downloadProgressCallback` | Receives `receivedBytes` / `totalBytes` for progress UI |
| `updateDialog` | Show native prompt before installing update |
| `appendReleaseDescription` | Show server-side release notes in dialog |
| `disallowRestart()` / `allowRestart()` | Prevent updates interrupting critical flows (e.g. checkout) |
| `getUpdateMetadata()` | Query metadata for current/pending/previous update |
| `isFirstRun` | True on first launch after a new bundle activates |
| `isPending` | True if an update is downloaded but not yet applied |

**Important:** Any custom flow that skips `sync()` MUST call `notifyAppReady()` after the bundle loads, or CodePush will treat the update as a failure and roll back on next restart.

Source: https://docs.codemagic.io/rn-codepush/advanced-sync-options/
