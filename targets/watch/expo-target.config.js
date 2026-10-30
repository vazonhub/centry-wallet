/**
 * watchOS companion app for Centry, managed by @bacons/apple-targets. Swift
 * sources live in this folder. The watch talks to the phone over
 * WatchConnectivity (App Groups don't reach a separate device) — the phone-side
 * WCSession lives in the `CentryNative` module (modules/centry-native).
 *
 * Regenerate the Xcode project after edits with `npx expo prebuild --clean`.
 * NOTE: verify after prebuild that the generated Info.plist has
 * `WKApplication = YES` and `WKCompanionAppBundleIdentifier = by.vazon.centry`
 * (apple-targets usually sets these; check on the first build).
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch',
  name: 'watch',
  displayName: 'Centry',
  // watchOS apps MUST ship an app icon in an asset catalog — App Store
  // validation rejects the build otherwise (Missing CFBundleIconName /
  // "No icons found for watch application"). apple-targets generates the
  // AppIcon.appiconset (all watch sizes, alpha flattened onto white) and sets
  // ASSETCATALOG_COMPILER_APPICON_NAME when this is present. Path is relative
  // to this target folder; reuse the shared app logo.
  icon: '../../assets/logo-light-theme.png',
  deploymentTarget: '9.0',
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WidgetKit', 'AppIntents'],
  // Watch-side App Group shared with the complication (targets/watch-widget).
  // This is on the WATCH device — unrelated to the iOS App Group.
  entitlements: {
    'com.apple.security.application-groups': ['group.by.vazon.centry.watch'],
  },
};
