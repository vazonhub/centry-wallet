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
  // The complication is an appex embedded INSIDE the watch app, so iOS requires
  // its bundle id to be prefixed by the watch app's id (`by.vazon.centry.watch`).
  // apple-targets otherwise derives `<mainApp>.watch-widget` (a sibling of the
  // watch app), which fails install with "does not have expected identifier
  // prefix". Set it explicitly to nest correctly.
  bundleIdentifier: 'by.vazon.centry.watch.watch-widget',
  deploymentTarget: '9.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.by.vazon.centry.watch'],
  },
};
