const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [withIosDeploymentTarget]';
const MIN_TARGET = '15.1';

/**
 * Xcode 27 turns "pod targets iOS below the supported minimum" from a warning
 * into a hard build error. `expo-build-properties` raises the app's own target,
 * but some transitive pods and auto-generated resource-bundle targets (e.g.
 * MMKVAppExtension's *_Privacy bundle, RNSVG's *Filters) still carry a podspec
 * floor of iOS 12–13 and break the build. This plugin raises every pod target's
 * deployment target to the app minimum inside the Podfile `post_install` hook.
 */
function withIosDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const podfilePath = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) {
        return c;
      }

      const loop =
        `    ${MARKER} Xcode 27 rejects pods targeting iOS < ${MIN_TARGET}; raise the floor.\n` +
        `    installer.pods_project.targets.each do |target|\n` +
        `      target.build_configurations.each do |bc|\n` +
        `        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
        `        if current.nil? || current.to_f < ${MIN_TARGET}\n` +
        `          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'\n` +
        `        end\n` +
        `      end\n` +
        `    end\n`;

      // Insert the loop at the start of the post_install block.
      podfile = podfile.replace(/(post_install do \|installer\|\n)/, `$1${loop}`);

      fs.writeFileSync(podfilePath, podfile);
      return c;
    },
  ]);
}

module.exports = withIosDeploymentTarget;
