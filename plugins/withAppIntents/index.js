const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin — Siri / App Shortcuts (etap 8, docs/BUILD0_PLAN.md).
 *
 * Modern App Intents + AppShortcutsProvider must live in the MAIN app target
 * (not an extension) for Siri phrases to auto-register, so — unlike the widget
 * (@bacons/apple-targets) — they can't be a separate target. This plugin:
 *   1. copies the Swift sources into `ios/<app>/AppIntents/`,
 *   2. adds them to the app target's Sources build phase.
 *
 * It links NOTHING extra. The intents pass their prefill through the
 * `centry://add?…` deep link (OpenURLIntent, iOS 17+) — there is no App-Group
 * MMKV writer, so nothing double-links MMKVCore into the main target. An earlier
 * version added `pod 'MMKVAppExtension'` here; that second MMKVCore consumer
 * (the app already links MMKVCore via react-native-mmkv) corrupted the heap at
 * launch and is why Siri was disabled. Do NOT re-add a pod here.
 *
 * Idempotent and safe to re-run on `expo prebuild --clean`. It is a thin,
 * self-contained plugin: removing it from app.json fully disables Siri without
 * touching the rest of the app.
 */

const SWIFT_DIR = path.join(__dirname, 'swift');
const GROUP_NAME = 'AppIntents';

function swiftFiles() {
  return fs.readdirSync(SWIFT_DIR).filter((f) => f.endsWith('.swift'));
}

/** Copy the Swift sources into the generated iOS project. */
function withSwiftSourcesCopied(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const appName = cfg.modRequest.projectName;
      const dest = path.join(iosRoot, appName, GROUP_NAME);
      fs.mkdirSync(dest, { recursive: true });
      for (const f of swiftFiles()) {
        fs.copyFileSync(path.join(SWIFT_DIR, f), path.join(dest, f));
      }
      return cfg;
    },
  ]);
}

/** Register the copied Swift sources in the app target's Sources build phase. */
function withSwiftSourcesInTarget(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const appName = cfg.modRequest.projectName;
    const target = project.getFirstTarget().uuid;
    // Add to the project's main group with a SOURCE_ROOT-relative path so the
    // reference resolves to ios/<app>/AppIntents/<file> without double-prefixing.
    const mainGroup = project.getFirstProject().firstProject.mainGroup;

    for (const f of swiftFiles()) {
      const rel = `${appName}/${GROUP_NAME}/${f}`;
      if (!project.hasFile(rel)) {
        project.addSourceFile(rel, { target }, mainGroup);
      }
    }
    return cfg;
  });
}

module.exports = function withAppIntents(config) {
  return withSwiftSourcesInTarget(withSwiftSourcesCopied(config));
};
