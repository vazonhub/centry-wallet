import * as Notifications from 'expo-notifications';

import { useSettingsStore } from '@stores/settings.store';

/**
 * Local evening reminder (etap 8, docs/UX_SPEC.md#ядро-ввода). A single daily
 * LOCAL notification — never a remote push — that nudges the user to log what
 * they spent today. Compliant with rule 5: local notifications touch no network
 * and carry no financial data (the body is a fixed string).
 *
 * The one scheduled notification is keyed by a stable identifier so re-syncing
 * replaces rather than stacks. Tapping it opens the input sheet via the same
 * `centry://add` deep link the widget uses (handled by useNotificationResponse).
 */

/** Stable id so re-scheduling replaces the single reminder instead of stacking. */
export const EVENING_REMINDER_ID = 'centry-evening-reminder';

/** Deep link the reminder carries; shared with the widget tap (useWidgetDeepLink). */
export const ADD_DEEP_LINK = 'centry://add';

export interface HhMm {
  hour: number;
  minute: number;
}

/**
 * Parses an 'HH:MM' 24h string into hour/minute, clamped to valid ranges.
 * Falls back to 22:00 on malformed input so scheduling can never throw. Pure.
 */
export function parseHhMm(time: string): HhMm {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return { hour: 22, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

/** The reminder's notification content. Pure so the copy can be unit-tested. */
export function buildReminderContent(): Notifications.NotificationContentInput {
  return {
    title: 'Что сегодня потратил?',
    body: 'Запишите траты за день — это займёт пару секунд.',
    sound: false,
    // Read by useNotificationResponse to open the input sheet on tap.
    data: { url: ADD_DEEP_LINK },
  };
}

let handlerConfigured = false;

/**
 * Registers the foreground presentation behaviour once. Must run before any
 * notification can be shown, so bootstrap calls it early. Idempotent.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Cancels the scheduled evening reminder, if any. Never throws. */
export async function cancelEveningReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID);
  } catch {
    // Nothing scheduled / platform without notifications — ignore.
  }
}

/**
 * Brings the OS-scheduled reminder in line with current settings — the single
 * entry point the toggle, the time picker, and bootstrap all call. Cancels when
 * the toggle is off; otherwise (re)schedules a daily notification at the chosen
 * time, requesting permission if needed. Never throws: a reminder failing to
 * schedule must not break settings or launch.
 */
export async function syncEveningReminder(): Promise<void> {
  const { inputEveningPush, eveningPushTime } = useSettingsStore.getState();

  // Always clear first so a time change or a disable takes effect cleanly.
  await cancelEveningReminder();
  if (!inputEveningPush) return;

  try {
    const settled = await Notifications.getPermissionsAsync();
    const granted =
      settled.granted ||
      (settled.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;

    const { hour, minute } = parseHhMm(eveningPushTime);
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_REMINDER_ID,
      content: buildReminderContent(),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  } catch {
    // Permission denied mid-flight, or no notification support — leave unscheduled.
  }
}
