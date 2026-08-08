# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Context

This app (`apps/frontend`, Expo Router, `src/app/`) implements **SeatSignal**. Product context
and the detailed specification live in root `CLAUDE.md` and `.kiro/specs/seat-signal/`.

`shared` (workspace package, `"shared": "workspace:*"` dep) is already available: use its
prediction types (`packages/shared/src/prediction/scoring.ts`), zod schemas
(`packages/shared/src/schemas/`), `Result`/`AppError` helpers, and plan-limit constants
(`PRO_ENTITLEMENT_ID`, free-tier limits) rather than redefining them in this app.

## iOS development builds and Metro

- Open `ios/frontend.xcworkspace`, never `frontend.xcodeproj`; CocoaPods and the shared Run
  scheme are configured in the workspace.
- Start Metro before launching a development build: `pnpm --filter frontend start`. A signed app
  can launch successfully but remain on the development-client screen when Metro (`:8081`) is not
  running. Confirm locally with `curl http://127.0.0.1:8081/status` if necessary.
- Keep the phone and Mac on a routeable network. Expo development-client URLs contain the Mac's
  LAN address, so an iPhone cannot load the JS bundle when that address is unreachable.
- Do not run `expo run:ios --device` concurrently with Xcode. Concurrent builds can leave Xcode
  stuck with `unable to initiate PIF transfer session (operation in progress?)`. Stop the terminal
  build, quit Xcode, wait briefly, reopen the workspace, then run from one tool only.
- For a physical iPhone, enable Developer Mode, choose a Team with **Automatically manage
  signing** enabled, and create/select an Apple Development certificate. If installation fails
  with `hermesvm.framework ... No code signature found`, clean the build folder and rebuild after
  signing is configured; the embedded framework must be signed as well as the app bundle.

## RevenueCat and StoreKit testing

- Native RevenueCat purchases and RevenueCatUI paywalls require a custom development build;
  Expo Go is not a supported host for their native UI.
- `OfferingsManager.Error error 1` / `CONFIGURATION_ERROR` after RevenueCat successfully fetches
  its offerings means StoreKit returned no products. First compare the RevenueCat dashboard product
  IDs with the StoreKit configuration or App Store Connect exactly; this is not, by itself, proof
  that the RevenueCat public API key or bundle ID is wrong.
- Local products are defined in `ios/frontend/SeatSignal.storekit`. For local StoreKit testing,
  select `SeatSignal.storekit` in **Scheme → Edit Scheme → Run → Options → StoreKit
  Configuration**, then launch using Xcode's **Run** action. Select the file through the Xcode UI;
  don't hand-edit its scheme path because Xcode rewrites it in its own reference format. A
  QR/deep-link launch of an already installed development client does not apply the Run-scheme
  StoreKit environment.
- Keep `SeatSignal.storekit` registered as a `frontend` target resource. Do not create an
  `SKTestSession` from the production app delegate: it is a test-control API and can assert on a
  physical app launch. If the direct product diagnostic returns an empty list, investigate StoreKit
  configuration before changing RevenueCat keys or offerings.
- For testing against App Store Connect instead, remove the StoreKit configuration from the Run
  scheme and ensure the products are created and available in App Store Connect with the same IDs.
- Preserve `SENTRY_DISABLE_AUTO_UPLOAD=true` in the local Xcode development environment. It keeps
  missing local Sentry upload configuration from blocking Debug builds. `@sentry/cli` is an explicit
  frontend development dependency because the Xcode Sentry script must resolve it under pnpm.
