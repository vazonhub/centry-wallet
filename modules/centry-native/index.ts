import { requireOptionalNativeModule } from 'expo-modules-core';

/** App-Group UserDefaults bridge (iOS only). Null until the app is prebuilt. */
interface CentryNativeModule {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export default requireOptionalNativeModule<CentryNativeModule>('CentryNative');
