/**
 * WidgetKit extension target for Centry, managed by @bacons/apple-targets.
 * Swift sources live in this folder; `pods.rb` (same folder) links the
 * extension-safe MMKV pod. Regenerate the Xcode project after edits with
 * `npx expo prebuild --clean`.
 *
 * `deploymentTarget` MUST be set — the plugin defaults to iOS 18.0 otherwise.
 * It is iOS 16: lock-screen (accessory) widgets and the interactive quick-add
 * both require 16+, and — critically — a WidgetBundle that conditionally
 * includes a widget via `if #available` crashes at launch (SwiftUI's
 * `WidgetBundleBuilder.buildLimitedAvailability` traps), so both widgets must be
 * unconditionally available, i.e. the whole extension floors at 16.
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'widget',
  displayName: 'Centry',
  deploymentTarget: '16.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  entitlements: {
    'com.apple.security.application-groups': ['group.by.vazon.centry'],
  },
};
