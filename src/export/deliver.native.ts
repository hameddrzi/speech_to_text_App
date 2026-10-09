import { Directory, File } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import type { Recording } from '@/data/recordings';
import { recordingToMarkdown } from '@/export/markdown';
import { exportCacheDir, writePdfFile } from '@/export/pdf';
import { EXPORT_MIME, EXPORT_UTI, exportFileName, type ExportFormat } from '@/export/shared';
import type { ExportAction, ExportCapabilities, ExportOutcome } from '@/export/types';
import { readJSON, writeJSON } from '@/utils/storage';

export type { ExportAction, ExportCapabilities, ExportOutcome } from '@/export/types';

export const EXPORT_CAPABILITIES: ExportCapabilities = {
  saveToFolder: Platform.OS === 'android',
  share: true,
};

/** The Android folder (SAF tree URI) the user picked last time; its permission is persisted by expo-file-system. */
type ExportPrefs = { directoryUri?: string };
const PREFS_FILE = 'export';

function savedDirectoryUri(): string | null {
  return readJSON<ExportPrefs>(PREFS_FILE)?.directoryUri ?? null;
}

/**
 * Human name of a SAF folder: ".../tree/primary%3ADownload%2FNotes" → "Download/Notes",
 * the storage root → "Internal storage".
 */
export function folderLabel(uri: string): string {
  try {
    const tree = decodeURIComponent(uri.split('/tree/')[1]?.split('/document/')[0] ?? '');
    const [volume, path = ''] = tree.split(':');
    if (path) return path;
    return volume === 'primary' ? 'Internal storage' : volume || 'Selected folder';
  } catch {
    return 'Selected folder';
  }
}

/** Name of the folder exports are saved to on Android, or null if the user hasn't picked one yet. */
export function saveFolderName(): string | null {
  const uri = savedDirectoryUri();
  return uri ? folderLabel(uri) : null;
}

function isCancel(e: unknown): boolean {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  return /cancel/i.test(`${code ?? ''} ${message ?? ''}`);
}

/** Opens the system folder picker and remembers the choice. Returns null if cancelled. */
export async function pickSaveFolder(): Promise<string | null> {
  try {
    const dir = await Directory.pickDirectoryAsync(savedDirectoryUri() ?? undefined);
    writeJSON(PREFS_FILE, { directoryUri: dir.uri } satisfies ExportPrefs);
    return folderLabel(dir.uri);
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

/** Writes the export into the app cache (`<cache>/exports/<Title>.<ext>`). */
async function writeExportFile(r: Recording, format: ExportFormat): Promise<File> {
  if (format === 'pdf') return writePdfFile(r);
  const file = new File(exportCacheDir(), exportFileName(r.title, 'md'));
  file.create({ overwrite: true });
  file.write(recordingToMarkdown(r));
  return file;
}

/** Copies the cached file into the picked folder via the Storage Access Framework. */
function copyToFolder(source: File, directoryUri: string, format: ExportFormat): void {
  // SAF picks a free name itself ("Title (1).pdf") if the file already exists there.
  const target = new Directory(directoryUri).createFile(source.name, EXPORT_MIME[format]);
  try {
    target.write(source.bytesSync());
  } catch (e) {
    try {
      target.delete(); // don't leave an empty file behind
    } catch {}
    throw e;
  }
}

async function shareFile(file: File, format: ExportFormat): Promise<void> {
  if (!(await isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await shareAsync(file.uri, {
    mimeType: EXPORT_MIME[format],
    UTI: EXPORT_UTI[format],
    dialogTitle: format === 'pdf' ? 'Export PDF' : 'Export Markdown',
  });
}

/**
 * Generates the transcript file and delivers it:
 * - Android `save`: into the folder the user picked (asked once, then remembered).
 * - iOS `save` and any `share`: the system share sheet ("Save to Files", Mail, Notes…).
 */
export async function exportTranscript(r: Recording, format: ExportFormat, action: ExportAction): Promise<ExportOutcome> {
  const file = await writeExportFile(r, format);
  const fileName = file.name;

  if (action === 'share' || Platform.OS !== 'android') {
    await shareFile(file, format);
    return { kind: 'shared', format, fileName };
  }

  let directoryUri = savedDirectoryUri();
  if (directoryUri) {
    try {
      copyToFolder(file, directoryUri, format);
      return { kind: 'saved', format, fileName, folder: folderLabel(directoryUri) };
    } catch {
      // The folder was deleted or its permission revoked: ask again below.
    }
  }

  if (!(await pickSaveFolder())) return { kind: 'cancelled' };
  directoryUri = savedDirectoryUri();
  if (!directoryUri) throw new Error('Could not remember the selected folder.');
  copyToFolder(file, directoryUri, format);
  return { kind: 'saved', format, fileName, folder: folderLabel(directoryUri) };
}
