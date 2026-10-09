import type { ExportFormat } from '@/export/shared';

/**
 * - `save`: the platform's "download": a folder picker on Android, the share sheet (Save to Files)
 *   on iOS, a browser download on web.
 * - `share`: always the system share sheet (native only).
 */
export type ExportAction = 'save' | 'share';

export type ExportOutcome =
  /** Written to a user-chosen folder (Android). */
  | { kind: 'saved'; format: ExportFormat; fileName: string; folder: string }
  /** Handed to the share sheet (iOS, or "Share file…" on Android). */
  | { kind: 'shared'; format: ExportFormat; fileName: string }
  /** Browser download (web). */
  | { kind: 'downloaded'; format: ExportFormat; fileName: string }
  /** The browser print dialog was opened, where "Save as PDF" is available (web PDF). */
  | { kind: 'printed'; format: ExportFormat; fileName: string }
  | { kind: 'cancelled' };

export type ExportCapabilities = {
  /** Android: the main button saves into a folder the user picked once. */
  saveToFolder: boolean;
  /** A secondary "Share file…" action is available. */
  share: boolean;
  /** Hint shown under the PDF option, if the platform handles it differently. */
  pdfNote?: string;
};
