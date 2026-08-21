import type { ConfigContext, ExpoConfig } from 'expo/config';

const pkg = require('./package.json');

/**
 * Dynamic overlay over app.json. Owner-specific identifiers are intentionally
 * kept out of app.json — set them in `.env` (see `.env.example`). Forks build
 * fine without them: the EAS fields are only needed for cloud builds, which
 * are off until v1.0 (Centry Build 0 is installed locally via Xcode).
 *
 * Centry has NO network features, so there are no API/ads/analytics URLs here —
 * the only env vars are EAS owner/project id.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  return {
    ...base,
    version: pkg.version,
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
    ios: {
      ...base.ios,
      // @bacons/apple-targets needs a Team ID to sign the widget extension.
      // Owner-specific (like EXPO_OWNER above), so it lives in `.env`, not
      // app.json — forks build the app fine without it (only the widget/
      // App-Intents targets need signing).
      ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
    },
    extra: {
      ...base.extra,
      eas: {
        ...(base.extra?.eas as Record<string, unknown> | undefined),
        ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}),
      },
    },
  };
};
