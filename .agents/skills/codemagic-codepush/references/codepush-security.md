# CodePush Security and Access

## Access Tokens

Tokens are self-service — generated via the Codemagic dashboard:

1. Go to **OTA Updates → Manage Access Keys**
2. Click **Generate key**
3. Enter a name and expiration period
4. The key is shown **once** — copy it before closing
5. Keys can be revoked from the same screen

Store tokens as environment variables / CI secrets, never hardcode them.

```bash
# With token inline (non-interactive)
code-push login --access-key $ACCESS_TOKEN

# Interactive — token prompted
code-push login
```

> The server URL is no longer required — the CLI defaults to `codepush.pro`. Source: https://docs.codemagic.io/rn-codepush/setup/#authenticate-the-cli

---

## Cryptographic Signing (RSA)

For production apps, sign bundles so the SDK verifies authenticity before installing:

```bash
# Generate key pair
openssl genrsa -out codepush_private.key 2048
openssl rsa -in codepush_private.key -pubout -out codepush_public.key
```

- **Private key**: Stored in CI secrets; signs the bundle during `release-react`
- **Public key**: Embedded in the app binary

**iOS — Info.plist:**
```xml
<key>CodePushPublicKey</key>
<string>-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----</string>
```

**Android — strings.xml:**
```xml
<string name="CodePushPublicKey">-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----</string>
```

If RSA signing is enabled, the public key in the app must match the private key used to sign the release — otherwise the update will be rejected at install time with `[CodePush] Update failed to install`.
