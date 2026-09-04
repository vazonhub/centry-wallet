/**
 * watchOS complication (watch-face widget) for Centry, managed by
 * @bacons/apple-targets. It's a watchOS widget EXTENSION embedded in the watch
 * app (targets/watch); apple-targets wires the embedding. It reads the payload
 * the watch app cached in the shared watch-side App Group and shows the remaining
 * "можно сегодня" amount + today's spend.
 *
 * Regenerate with `npx expo prebuild --clean`.
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch-widget',
  name: 'watch-widget',
  displayName: 'Centry',
  deploymentTarget: '9.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.by.vazon.centry.watch'],
  },
};
