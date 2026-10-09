import type { Recording } from '@/data/recordings';
import {
  exportSegments,
  formatLongDate,
  formatTime,
  formatTimestamp,
  statusLabel,
  unavailableReason,
  wordCount,
} from '@/export/shared';

/**
 * Escapes characters that Markdown would otherwise read as formatting, so user text
 * (titles, transcript lines) always comes out literally.
 */
export function escapeMarkdown(text: string): string {
  return (
    text
      .replace(/[\\`*_[\]<>#|~]/g, (c) => `\\${c}`)
      // A line starting with "-", "+", "=" or "1." would become a list item or a heading underline.
      .replace(/^(\s*)([-+=])/gm, '$1\\$2')
      .replace(/^(\s*\d+)([.)])/gm, '$1\\$2')
  );
}

/** The recording as a Markdown document: title, metadata list, then the time-coded transcript. */
export function recordingToMarkdown(r: Recording): string {
  const segments = exportSegments(r);
  const unavailable = unavailableReason(r);
  const date = [formatLongDate(r.createdAt), formatTime(r.createdAt)].filter(Boolean).join(', ');

  const lines: string[] = [
    `# ${escapeMarkdown(r.title.trim() || 'Untitled recording')}`,
    '',
    `- **Date:** ${date}`,
    `- **Duration:** ${formatTimestamp(r.duration)}`,
    ...(unavailable ? [] : [`- **Words:** ${wordCount(r).toLocaleString()}`]),
    `- **Status:** ${statusLabel(r)}`,
    '',
    '## Transcript',
    '',
  ];

  if (unavailable) {
    lines.push(`> **${unavailable.title}.** ${escapeMarkdown(unavailable.detail)}`, '');
  } else {
    for (const s of segments) {
      lines.push(`**[${formatTimestamp(s.start)}]** ${escapeMarkdown(s.text)}`, '');
    }
  }

  lines.push('---', '', '*Exported from Voice. Transcribed on device.*', '');
  return lines.join('\n');
}
