/**
 * Helpers shared by the Markdown and PDF exporters. Pure functions only (no React Native imports),
 * so the PDF template can be rendered and previewed in a plain browser or Node.
 */
import type { Recording } from '@/data/recordings';
import { formatDuration } from '@/utils/format';

export type ExportFormat = 'pdf' | 'md';

export const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
};

/** Apple Uniform Type Identifiers, used by the iOS share sheet. */
export const EXPORT_UTI: Record<ExportFormat, string> = {
  pdf: 'com.adobe.pdf',
  md: 'net.daringfireball.markdown',
};

/** "Product team meeting" → "Product-team-meeting.pdf". Safe on Android, iOS, Windows and macOS. */
export function exportFileName(title: string, format: ExportFormat): string {
  const base =
    title
      .normalize('NFKC')
      .replace(/&/g, ' and ')
      // Characters that are invalid in file names somewhere, plus control characters.
      .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]+/g, ' ')
      // Dashes and other separators read better as a single hyphen.
      .replace(/[\s\u2013\u2014_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80)
      .replace(/[-.]+$/g, '') || 'Recording';
  return `${base}.${format}`;
}

/** Whisper text, cleaned for display: single spaces, no stray line breaks. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Segments with actual text, in time order. */
export function exportSegments(r: Recording) {
  return r.transcript
    .map((s) => ({ ...s, text: cleanText(s.text) }))
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.start - b.start);
}

export function wordCount(r: Recording): number {
  return exportSegments(r).reduce((n, s) => n + s.text.split(' ').filter(Boolean).length, 0);
}

/** 0:00 / 1:05 / 1:02:05, same as the detail screen. */
export const formatTimestamp = formatDuration;

/** "Thursday, 9 October 2026" */
export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "9 Oct 2026" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "09:42" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(r: Recording): string {
  switch (r.transcriptStatus) {
    case 'done':
      return 'Transcribed';
    case 'processing':
      return 'Transcription in progress';
    case 'failed':
      return 'Transcription failed';
    default:
      return 'Not transcribed';
  }
}

/**
 * When there is no transcript text to export, an honest explanation of why.
 * `null` means the transcript is available.
 */
export function unavailableReason(r: Recording): { title: string; detail: string } | null {
  if (r.transcriptStatus === 'done') {
    if (exportSegments(r).length > 0) return null;
    return { title: 'No speech detected', detail: 'Whisper finished, but found no words in this recording.' };
  }
  if (r.transcriptStatus === 'processing') {
    return {
      title: 'Transcript not available yet',
      detail: 'This recording is still being transcribed on the device. Export again once it has finished.',
    };
  }
  if (r.transcriptStatus === 'failed') {
    return {
      title: 'Transcript not available',
      detail: r.transcriptError
        ? `Transcription failed: ${cleanText(r.transcriptError)}`
        : 'Transcription failed. Open the recording and tap Retry.',
    };
  }
  return { title: 'Transcript not available', detail: 'This recording has not been transcribed.' };
}
