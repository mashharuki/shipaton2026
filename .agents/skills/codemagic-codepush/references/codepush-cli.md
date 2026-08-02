# Codemagic CodePush CLI

Common CodePush CLI commands for logging in to the CodePush server, creating apps on your CodePush account, and managing rollouts.

Use `code-push --help` and `code-push release-react --help` to check commands for current `@codemagic/code-push-cli` releases.

## 1) Install and authenticate CLI

```bash
npm install -g @codemagic/code-push-cli
code-push login https://codepush.pro --access-key "$CODEPUSH_TOKEN"
code-push whoami
```

`$CODEPUSH_TOKEN` must come from Codemagic-provided access credentials.

## 2) Create platform-specific apps

Use separate apps for each platform:

```bash
code-push app add MyApp-iOS
code-push app add MyApp-Android
code-push app ls
```

Retrieve deployment keys (for `Info.plist` and `strings.xml`):

```bash
code-push deployment ls MyApp-iOS -k
code-push deployment ls MyApp-Android -k
```

## 3) Manage rollout lifecycle

Release:

```bash
code-push release-react MyApp-iOS ios --deploymentName Staging
code-push release-react MyApp-Android android --deploymentName Staging
```

Promote:

```bash
code-push promote MyApp-iOS Staging Production
code-push promote MyApp-Android Staging Production
```

Patch:

```bash
code-push patch MyApp-iOS Production --mandatory
code-push patch MyApp-Android Production --rollout 50
```

Rollback:

```bash
code-push rollback MyApp-iOS Production
code-push rollback MyApp-Android Production
```

Add `--targetBinaryVersion` explicitly when auto-detection does not match your build metadata.