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
 *   2. adds them to the app target's Sources build phase,
 *   3. adds `pod 'MMKVAppExtension'` (modular headers) to the app target so the
 *      intent can drop a prefill in the App-Group MMKV the app reads
 *      (src/services/intents).
 *
 * Idempotent and safe to re-run on `expo prebuild --clean`. It is a thin,
 * self-contained plugin: removing it from app.json fully disables Siri without
 * touching the rest of the app.
 */

const SWIFT_DIR = path.join(__dirname, 'swift');
const GROUP_NAME = 'AppIntents';
const POD_LINE = "  pod 'MMKVAppExtension', :modular_headers => true";

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

/** Add the extension-safe MMKV pod to the app target (idempotent). */
function withMmkvPod(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const appName = cfg.modRequest.projectName;
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes("pod 'MMKVAppExtension'")) return cfg;

      const anchor = new RegExp(`target ['"]${appName}['"] do`);
      const match = anchor.exec(contents);
      if (match) {
        const insertAt = match.index + match[0].length;
        contents = `${contents.slice(0, insertAt)}\n${POD_LINE}${contents.slice(insertAt)}`;
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = function withAppIntents(config) {
  return withMmkvPod(withSwiftSourcesInTarget(withSwiftSourcesCopied(config)));
};
