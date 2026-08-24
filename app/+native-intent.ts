/**
 * Native deep-link interception (Expo Router).
 *
 * `redirectSystemPath` runs *before* Expo Router resolves an incoming URL —
 * including the cold-start launch URL — so it is the reliable place to rewrite
 * links that don't map 1:1 to a route file. Doing it only in a `useEffect` (as
 * `useWidgetDeepLink` does) loses a race on cold start and briefly renders the
 * built-in "Unmatched Route" / sitemap screen (or gets stuck on the splash).
 *
 * The Home-screen widget, the evening reminder push, and the deep link all open
 * `centry://add` (also `centry://input`). There is no `add`/`input` route file,
 * so without this redirect Expo Router falls through to the sitemap. We send
 * every such tap to the Home tab (the input sheet always belongs over Главная,
 * never whichever tab was last active); the sheet itself is opened from the raw
 * launch URL by `useWidgetDeepLink` once the root layout mounts. Anything else
 * is passed through untouched so dev-client / OAuth links keep working.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // `path` may arrive as a full URL (`centry://add`) or already scheme-stripped
    // (`/add` | `add`). Extract the first meaningful segment either way.
    const withoutScheme = path.replace(/^[a-zA-Z][\w+.-]*:\/\//, '');
    const firstSegment = withoutScheme.replace(/^\/+/, '').split(/[/?#]/)[0];
    if (firstSegment === 'add' || firstSegment === 'input') {
      return '/(tabs)/(home)';
    }
  } catch {
    // Malformed path — fall through to the default resolution below.
  }
  return path;
}
