/**
 * CSV import — the file-picking / reading side-effect boundary (no UI, no
 * business logic). Nothing leaves the device: the user picks a local CSV and its
 * text is read from the app cache. Not the network module (rule 5 holds).
 */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/**
 * Opens the system file picker for a CSV and returns its text, or null if the
 * user cancels. Copies into the cache dir so the URI is always readable.
 */
export async function pickAndReadCsv(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'public.comma-separated-values-text',
      'text/plain',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled) return null;
  const asset = res.assets?.[0];
  if (!asset) return null;
  return await new File(asset.uri).text();
}
