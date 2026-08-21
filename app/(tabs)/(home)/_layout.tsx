import { Stack } from 'expo-router';

/** Stack for the Home tab (room for pushed detail screens later). */
export default function HomeStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
