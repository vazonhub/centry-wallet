import { runMigrations } from '@db';
import { configureNotificationHandler, syncEveningReminder } from '@services/notifications';
import { startWatchActionListener } from '@services/watch';
import { waitForSettingsHydration } from '@stores/settings.store';

import { DataController } from './data.controller';
import { seedDefaultsIfEmpty } from './seed';

/**
 * App bootstrap orchestration (docs/ARCHITECTURE.md — controllers are the only
 * bridge between views and db/services). Runs migrations, seeds defaults (rule 3),
 * waits for settings hydration, loads the data snapshot, then refreshes rates and
 * syncs the evening reminder in the background (never blocking the first paint).
 */
export async function initApp(): Promise<void> {
  configureNotificationHandler();
  await runMigrations();
  await seedDefaultsIfEmpty();
  await waitForSettingsHydration();
  await DataController.loadAll();
  void DataController.refreshRates();
  // Listen for actions the Apple Watch sends back (add expense / change budget).
  startWatchActionListener();
  // Reconcile the OS-scheduled reminder with settings (etap 8). Fire-and-forget:
  // a reminder that fails to (re)schedule must never block launch.
  void syncEveningReminder();
}
