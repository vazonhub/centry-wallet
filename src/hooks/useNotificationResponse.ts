import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { openInputSheet } from '@components/inputSheetRef';
import { ADD_DEEP_LINK } from '@services/notifications';

/** True when a notification response carries the "add" deep link. */
function opensInput(response: Notifications.NotificationResponse | null): boolean {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith(ADD_DEEP_LINK);
}

/**
 * Opens the input sheet when the evening reminder is tapped (etap 8) — both a
 * warm tap (listener) and a cold start from the notification
 * (getLastNotificationResponseAsync). Mounted once at the app root next to the
 * widget deep-link hook; the reminder and the widget both funnel to the same
 * input sheet.
 */
export function useNotificationResponse(): void {
  useEffect(() => {
    let cancelled = false;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!cancelled && opensInput(response)) openInputSheet();
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (opensInput(response)) openInputSheet();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
