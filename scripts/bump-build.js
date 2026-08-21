#!/usr/bin/env node
/**
 * Increments the native iOS build number in app.json:
 *   - ios.buildNumber (string, e.g. "1" -> "2")
 *
 * Centry is iOS-only (B3) — there is no android.versionCode to bump.
 *
 * We manage this locally (eas.json `appVersionSource: "local"`, no
 * `autoIncrement`) so that EVERY iOS target — the main app plus the embedded
 * WidgetKit extension created by the config plugin — bakes the SAME
 * CFBundleVersion during prebuild. Apple rejects an app whose extension
 * CFBundleVersion differs from the parent app's, and EAS remote autoIncrement
 * only ever bumped the main target (see RELEASE.md).
 *
 * Run standalone for a same-version rebuild (`npm run bump:build`); the
 * `bump:patch|minor|major` scripts also call it so a release bump moves the
 * build number forward too.
 */
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const { ios } = config.expo;

const currentIos = parseInt(ios.buildNumber, 10);
if (Number.isNaN(currentIos)) {
  throw new Error(`ios.buildNumber is not an integer string: ${JSON.stringify(ios.buildNumber)}`);
}
const nextIos = currentIos + 1;
ios.buildNumber = String(nextIos);

fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');

console.log(`ios.buildNumber: ${currentIos} -> ${nextIos}`);
