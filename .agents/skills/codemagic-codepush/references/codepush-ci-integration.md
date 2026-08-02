# CodePush CI Integration

For Codemagic-specific YAML setup, see `codepush-releases-codemagic-ci.md`.

---

## GitHub Actions

Store the token as a repository secret (e.g. `CODEPUSH_TOKEN`). The `env` block is required — without it `$CODEPUSH_TOKEN` in `run` is empty.

```yaml
- name: Install CodePush CLI
  run: npm install -g @codemagic/code-push-cli

- name: Release CodePush update
  env:
    CODEPUSH_TOKEN: ${{ secrets.CODEPUSH_TOKEN }}
  run: |
    code-push login https://codepush.pro --access-key $CODEPUSH_TOKEN
    code-push release-react MyApp-Android android --deploymentName Staging
```

---

## Release Trigger Strategies

| Strategy | Trigger |
|---|---|
| On every merge to main | Push to `main` |
| On tag/version | `v*` tag created |
| Manual | Workflow dispatch |

---

## Token Storage

| CI system | Where to store |
|---|---|
| Codemagic | App Settings → Environment variables (mark as secure) |
| GitHub Actions | Repository Settings → Secrets |
| Other CI | Encrypted secret/env var — never hardcode in YAML |
