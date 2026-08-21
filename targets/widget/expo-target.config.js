/**
 * WidgetKit extension target for Centry, managed by @bacons/apple-targets.
 * Swift sources live in this folder; `pods.rb` (same folder) links the
 * extension-safe MMKV pod. Regenerate the Xcode project after edits with
 * `npx expo prebuild --clean`.
 *
 * `deploymentTarget` MUST be set — the plugin defaults to iOS 18.0 otherwise,
 * which would not match the app's 15.1 floor.
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'widget',
  displayName: 'Centry',
  deploymentTarget: '15.1',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.by.vazon.centry'],
  },
};
