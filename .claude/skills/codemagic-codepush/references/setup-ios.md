# iOS Setup (React Native + CodePush)

Apply these steps for iOS integration.

## 1) Install iOS dependencies

```bash
cd ios
pod install
cd ..
```

## 2) Wire bundle loading to CodePush

Update app delegate to load JS bundle from CodePush for release builds.

### Objective-C (`AppDelegate.m`)

```objective-c
#import <CodePush/CodePush.h>

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [CodePush bundleURL];
#endif
}
```

### Swift (`AppDelegate.swift`)

```swift
import CodePush

override func bundleURL() -> URL? {
#if DEBUG
  RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  CodePush.bundleURL()
#endif
}
```

## 3) Configure Info.plist keys

Add these keys to `ios/<App>/Info.plist`:

```xml
<key>CodePushServerURL</key>
<string>https://codepush.pro/</string>
<key>CodePushDeploymentKey</key>
<string>YOUR_DEPLOYMENT_KEY</string>
```

Optional for code signing verification:

```xml
<key>CodePushPublicKey</key>
<string>-----BEGIN PUBLIC KEY-----
...public key...
-----END PUBLIC KEY-----</string>
```

## 4) Check minimum supported iOS version in Podfile

Check the `ios/Podfile` for minimum supported ios version is `15.5` or higher.

`platform :ios, '15.5'`

## 5) Binary version caveat

If release fails due to iOS semver parsing, set `CFBundleShortVersionString` to a valid semver or pass:

```bash
code-push release-react <IOS_APP_NAME> ios --targetBinaryVersion 1.0.0
```
