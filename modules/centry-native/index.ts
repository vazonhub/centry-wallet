import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * App-Group UserDefaults bridge + Apple Watch (WatchConnectivity) link (iOS
 * only). Null until the app is prebuilt with the native module.
 */
interface CentryNativeModule {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Pushes the latest watch payload (JSON) to the paired Apple Watch. */
  sendWatchContext(payload: string): void;
  /** True when a watch is paired. */
  isWatchPaired(): boolean;
  /** Subscribe to actions the watch sends back (add expense / change budget). */
  addListener(
    event: 'onWatchAction',
    listener: (e: { payload: string }) => void,
  ): { remove(): void };
}

export default requireOptionalNativeModule<CentryNativeModule>('CentryNative');
