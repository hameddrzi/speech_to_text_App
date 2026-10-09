import { Directory, File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { Platform } from 'react-native';

import type { Recording } from '@/data/recordings';
import { renderTranscriptHtml } from '@/export/pdf-template';
import { exportFileName } from '@/export/shared';

/** A4 in PostScript points (72 per inch), the unit expo-print expects. */
const A4 = { width: 595, height: 842 };

/** Exported files are written here first; the system may clear it at any time. */
export function exportCacheDir(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Renders the transcript PDF (native only) and returns it as `<cache>/exports/<Title>.pdf`.
 * expo-print writes to a random file name, so it is moved to a readable one for sharing.
 */
export async function writePdfFile(r: Recording): Promise<File> {
  const { uri } = await printToFileAsync({
    html: renderTranscriptHtml(r),
    ...A4,
    // iOS ignores CSS @page margins, so they are passed natively there. Android's WebView honours
    // the @page rules in the template (including the footer and page numbers).
    ...(Platform.OS === 'ios' ? { margins: { top: 44, bottom: 44, left: 0, right: 0 } } : null),
  });
  const rendered = new File(uri);
  const target = new File(exportCacheDir(), exportFileName(r.title, 'pdf'));
  rendered.moveSync(target, { overwrite: true });
  return target;
}
