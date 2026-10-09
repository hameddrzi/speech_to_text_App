/**
 * Web variant of the export delivery (the phone version is deliver.native.ts).
 * Markdown is a normal browser download; the PDF goes through the browser's print dialog,
 * because expo-print can't write files on web. "Save as PDF" there gives the same designed page.
 */
import type { Recording } from '@/data/recordings';
import { recordingToMarkdown } from '@/export/markdown';
import { escapeHtml, renderTranscriptHtml } from '@/export/pdf-template';
import { EXPORT_MIME, exportFileName, type ExportFormat } from '@/export/shared';
import type { ExportAction, ExportCapabilities, ExportOutcome } from '@/export/types';

export type { ExportAction, ExportCapabilities, ExportOutcome } from '@/export/types';

export const EXPORT_CAPABILITIES: ExportCapabilities = {
  saveToFolder: false,
  share: false,
  pdfNote: 'Opens the print dialog. Choose “Save as PDF”.',
};

export function saveFolderName(): string | null {
  return null;
}

export async function pickSaveFolder(): Promise<string | null> {
  return null;
}

function download(content: string, fileName: string, format: ExportFormat): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${EXPORT_MIME[format]};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Prints the designed page from a hidden iframe; the document title becomes the suggested PDF name. */
function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        reject(new Error('Printing is not available in this browser.'));
        return;
      }
      win.focus();
      win.print(); // blocks until the dialog closes in most browsers
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export async function exportTranscript(r: Recording, format: ExportFormat, _action: ExportAction): Promise<ExportOutcome> {
  const fileName = exportFileName(r.title, format);
  if (format === 'md') {
    download(recordingToMarkdown(r), fileName, format);
    return { kind: 'downloaded', format, fileName };
  }
  const docTitle = escapeHtml(fileName.replace(/\.pdf$/, ''));
  await printHtml(renderTranscriptHtml(r).replace(/<title>[^<]*<\/title>/, () => `<title>${docTitle}</title>`));
  return { kind: 'printed', format, fileName };
}
