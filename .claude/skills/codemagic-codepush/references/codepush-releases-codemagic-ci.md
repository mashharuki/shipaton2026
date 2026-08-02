# CodePush Releases with Codemagic CI

OTA release workflows only produce and upload a **JavaScript bundle** — they do **not** build the native binary. Keep them as a **separate workflow** from your iOS/Android store build pipelines.

For all available release flags, see `codepush-releases.md`.

---

## 1) Store the access token

| Scope | Where |
|---|---|
| Single app | **App Settings → Environment variables** → add `CODEPUSH_TOKEN`, mark as **secure** |
| All apps in team | **Team Settings → Global variables and secrets** → add `CODEPUSH_TOKEN`, mark as **secure** |

Use team-level if the same token is shared across multiple apps.

---

## 2) Release to Staging

```yaml
workflows:
  codepush-staging:
    name: CodePush — Release to Staging
    scripts:
      - name: Install CodePush CLI
        script: npm install -g @codemagic/code-push-cli

      - name: CodePush login
        script: code-push login --access-key "$CODEPUSH_TOKEN"

      - name: Install dependencies
        script: npm ci

      - name: Release iOS OTA to Staging
        script: |
          IOS_VERSION=$(xcodebuild -showBuildSettings \
           -project ios/PROJECT_NAME.xcodeproj \
           -target PROJECT_TARGET \
           | awk -F "= " '/MARKETING_VERSION/ {print $2; exit}')
          code-push release-react MyApp-iOS ios \
            --deploymentName Staging \
            --targetBinaryVersion "$IOS_VERSION"

      - name: Release Android OTA to Staging
        script: |
          ANDROID_VERSION=$(grep versionName android/app/build.gradle | head -1 \
           | sed 's/.*versionName "\(.*\)".*/\1/')
          code-push release-react MyApp-Android android \
            --deploymentName Staging \
            --targetBinaryVersion "$ANDROID_VERSION"
```

---

## 3) Promote to Production

Run after validating the Staging release. Use a separate workflow or trigger manually.

```yaml
workflows:
  codepush-promote:
    name: CodePush — Promote to Production
    scripts:
      - name: Install CodePush CLI
        script: npm install -g @codemagic/code-push-cli

      - name: CodePush login
        script: code-push login --access-key "$CODEPUSH_TOKEN"

      - name: Promote iOS to Production
        script: code-push promote MyApp-iOS Staging Production

      - name: Promote Android to Production
        script: code-push promote MyApp-Android Staging Production
```

---

## Trigger options

| Trigger | codemagic.yaml config |
|---|---|
| On push to a branch | `triggering: events: [push] branches: [codepush-release]` |
| On tag | `triggering: events: [tag] tag_patterns: [pattern: "ota-*"]` |
| Manual only | Omit `triggering` block entirely |
