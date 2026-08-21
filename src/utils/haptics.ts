import * as Haptics from 'expo-haptics';

/** Light tap — chip press, segmented control switch, navigation. */
export const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** Medium tap — pull-to-refresh, sheet snap. */
export const hapticMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Success — transaction saved, account created. */
export const hapticSuccess = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
