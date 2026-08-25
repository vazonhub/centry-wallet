/**
 * CSV export — the file/share side-effect boundary (no UI, no business logic).
 *
 * This is NOT the network module: nothing is uploaded. The CSV is written to the
 * app's own cache directory and handed to the iOS share sheet, which the user
 * drives (AirDrop, Files, Mail, …). Personal data leaves the device only if the
 * user explicitly chooses a destination — rule 5 (no automatic egress) holds.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { CSV_BOM } from '@utils/csv';

export type ShareCsvResult = 'shared' | 'unavailable';

/**
 * Writes `csvBody` (BOM-prefixed for Excel/Cyrillic) to a cache-dir file and
 * opens the share sheet. Returns 'unavailable' when the platform has no sharing
 * UI (never on a real device). Throws only on a genuine filesystem failure.
 */
export async function writeAndShareCsv(filename: string, csvBody: string): Promise<ShareCsvResult> {
  const file = new File(Paths.cache, filename);
  // Delete-then-create so a stale export from an earlier run can't linger.
  if (file.exists) file.delete();
  file.create();
  file.write(CSV_BOM + csvBody);

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Экспорт Centry',
  });
  return 'shared';
}
