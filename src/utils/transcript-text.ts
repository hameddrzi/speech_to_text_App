import type { Recording, TranscriptSegment } from '@/data/recordings';
import { formatDuration } from '@/utils/format';

/**
 * Plain-text transcript for the system share sheet (Telegram, WhatsApp, Mail, Notes…).
 * Pure functions only, so the export feature can reuse them.
 */

/** Android intent extras live in a ~1 MB Binder buffer; stay well below it. */
export const MAX_SHARE_CHARS = 60_000;

/** A pause at least this long between segments starts a new paragraph. */
const PARAGRAPH_GAP_SECONDS = 2;
/** …and so does every Nth segment, so long monologues stay readable in a chat bubble. */
const SEGMENTS_PER_PARAGRAPH = 4;

const FOOTER = '— Transcribed on-device with Voice';
const FOOTER_NO_TRANSCRIPT = '— Shared from Voice';

/** "Friday, 9 October 2026 at 09:42" (locale-dependent). */
export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
}

/** "Friday, 9 October 2026 at 09:42 · 3:04" */
export function formatShareMeta(recording: Recording): string {
  const date = formatFullDate(recording.createdAt);
  const duration = formatDuration(recording.duration);
  return date ? `${date} · ${duration}` : duration;
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Joins segments into paragraphs separated by blank lines. Empty string when there is no text. */
export function transcriptParagraphs(segments: TranscriptSegment[]): string {
  const paragraphs: string[][] = [];
  let current: string[] = [];
  let prevEnd: number | null = null;

  for (const segment of segments) {
    const text = clean(segment.text);
    if (!text) continue;
    const pause = prevEnd === null ? 0 : segment.start - prevEnd;
    if (current.length > 0 && (pause >= PARAGRAPH_GAP_SECONDS || current.length >= SEGMENTS_PER_PARAGRAPH)) {
      paragraphs.push(current);
      current = [];
    }
    current.push(text);
    prevEnd = segment.end;
  }
  if (current.length > 0) paragraphs.push(current);

  return paragraphs.map((p) => p.join(' ')).join('\n\n');
}

/** One-line explanation used instead of the transcript when there is no text to share. */
export function transcriptUnavailableNote(recording: Recording): string {
  switch (recording.transcriptStatus) {
    case 'processing':
      return 'Transcript not available yet.';
    case 'failed':
      return 'Transcript not available — transcription failed.';
    case 'none':
      return 'No transcript for this recording.';
    default:
      return 'No speech detected.';
  }
}

/** Cuts `body` so it fits in `budget` characters, on a word boundary, with a visible note. */
function truncate(body: string, budget: number): string {
  if (body.length <= budget) return body;
  const note = '\n\n[Transcript truncated — open the recording in Voice for the full text.]';
  let cut = body.slice(0, Math.max(0, budget - note.length - 1));
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > cut.length * 0.8) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}…${note}`;
}

/**
 * Title, meta line, blank line, transcript paragraphs (or a short note), footer.
 * Plain text, capped at {@link MAX_SHARE_CHARS}.
 */
export function formatTranscriptForSharing(recording: Recording): string {
  const title = clean(recording.title) || 'Untitled recording';
  const header = `${title}\n${formatShareMeta(recording)}`;
  const transcript = recording.transcriptStatus === 'done' ? transcriptParagraphs(recording.transcript) : '';
  const footer = `\n\n${transcript ? FOOTER : FOOTER_NO_TRANSCRIPT}`;
  const body = transcript || transcriptUnavailableNote(recording);

  const budget = MAX_SHARE_CHARS - header.length - footer.length - 2;
  return `${header}\n\n${truncate(body, budget)}${footer}`;
}
