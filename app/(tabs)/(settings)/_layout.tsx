import { Stack } from 'expo-router';

/**
 * Settings stack. All screens are headerless — each sub-page draws its own
 * back button + large title via `<ScreenHeader>` so the left margin matches the
 * index screen (Bsuir каркас).
 */
export default function SettingsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
