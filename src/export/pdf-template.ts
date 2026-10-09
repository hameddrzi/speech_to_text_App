/**
 * The PDF transcript as a self-contained HTML page (A4), rendered to PDF by expo-print.
 *
 * Pure function, no React Native imports: the page can be opened in any browser to preview it.
 * Colors mirror the tokens in src/constants/theme.ts (that module imports react-native, so the
 * values are repeated here).
 */
import type { Recording } from '@/data/recordings';
import {
  exportSegments,
  formatLongDate,
  formatShortDate,
  formatTime,
  formatTimestamp,
  unavailableReason,
  wordCount,
} from '@/export/shared';

const C = {
  label: '#0B0B0F',
  labelSecondary: 'rgba(60,60,67,0.62)',
  labelTertiary: 'rgba(60,60,67,0.42)',
  separator: 'rgba(60,60,67,0.12)',
  hairline: 'rgba(15,23,42,0.07)',
  record: '#FF3B30',
  recordSoft: 'rgba(255,59,48,0.12)',
  tint: '#0A84FF',
  tintSoft: 'rgba(10,132,255,0.10)',
  success: '#34C759',
  successSoft: 'rgba(52,199,89,0.12)',
  successText: '#1F8A3B',
  warningSoft: 'rgba(255,159,10,0.14)',
  warningText: '#B86E00',
  blobA: '#FFD6D3',
  blobB: '#D6E8FF',
  blobC: '#EDE3FF',
} as const;

const FONT = '-apple-system, "SF Pro Text", "SF Pro", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_DISPLAY = '-apple-system, "SF Pro Display", "SF Pro", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';

/** Page geometry in CSS px (96 per inch). A4 = 794 × 1123. */
const PAGE_X = 56;
/** Inner width of the waveform card, used as the SVG coordinate space. */
const WAVE_W = 794 - PAGE_X * 2 - 2 * 20;
const WAVE_H = 46;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Mirrored waveform bars (like the app's scrubber), downsampled to at most `maxBars`. */
function waveformSvg(values: number[], maxBars = 112): string {
  const clean = values.filter((v) => Number.isFinite(v)).map((v) => Math.min(1, Math.max(0, v)));
  if (clean.length === 0) return '';
  const n = Math.min(maxBars, clean.length);
  const bars: number[] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i * clean.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * clean.length) / n));
    bars.push(Math.max(...clean.slice(from, to)));
  }
  const step = WAVE_W / n;
  const barW = Math.min(4, step * 0.56);
  const rects = bars
    .map((v, i) => {
      const h = Math.max(3, v * WAVE_H);
      const x = i * step + (step - barW) / 2;
      const y = (WAVE_H - h) / 2;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${(barW / 2).toFixed(2)}"/>`;
    })
    .join('');
  return `<svg class="wave" viewBox="0 0 ${WAVE_W} ${WAVE_H}" width="100%" height="${WAVE_H}" preserveAspectRatio="none" aria-hidden="true"><g fill="${C.record}">${rects}</g></svg>`;
}

const ICONS = {
  calendar: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  clock: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  text: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  device: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4" y="1.5" width="8" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.6 9.4l1.1 1.1 2.1-2.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  info: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.3v3.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="5" r="0.95" fill="currentColor"/></svg>`,
};

/** The app's mark: the record button (white disc, grey ring, red dot). */
const BRAND_MARK = `<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="#fff" stroke="rgba(60,60,67,0.22)" stroke-width="2"/><circle cx="14" cy="14" r="7.5" fill="${C.record}"/></svg>`;

function chip(icon: string, text: string, tone: 'plain' | 'success' | 'warning' = 'plain'): string {
  return `<span class="chip chip-${tone}">${icon}<span>${escapeHtml(text)}</span></span>`;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Full HTML document for the transcript PDF. */
export function renderTranscriptHtml(r: Recording): string {
  const title = r.title.trim() || 'Untitled recording';
  const segments = exportSegments(r);
  const unavailable = unavailableReason(r);
  const words = wordCount(r);
  const longDate = [formatLongDate(r.createdAt), formatTime(r.createdAt)].filter(Boolean).join(' · ');

  const chips = [
    chip(ICONS.calendar, formatShortDate(r.createdAt)),
    chip(ICONS.clock, formatTimestamp(r.duration)),
    unavailable ? '' : chip(ICONS.text, plural(words, 'word', 'words')),
    unavailable
      ? chip(ICONS.info, unavailable.title, 'warning')
      : chip(ICONS.device, 'Transcribed on device', 'success'),
  ].join('');

  const wave = waveformSvg(r.waveform);
  const waveCard = wave
    ? `<section class="wave-card">
        ${wave}
        <div class="wave-times"><span>0:00</span><span>${formatTimestamp(r.duration)}</span></div>
      </section>`
    : '';

  const body = unavailable
    ? `<div class="notice">
        <div class="notice-icon">${ICONS.info}</div>
        <div>
          <p class="notice-title">${escapeHtml(unavailable.title)}</p>
          <p class="notice-text">${escapeHtml(unavailable.detail)}</p>
        </div>
      </div>`
    : `<ol class="segments">
        ${segments
          .map(
            (s) => `<li class="segment">
              <span class="time">${formatTimestamp(s.start)}</span>
              <p class="text">${escapeHtml(s.text)}</p>
            </li>`,
          )
          .join('')}
      </ol>
      <p class="end"><span></span>End of transcript<span></span></p>`;

  const sectionMeta = unavailable ? '' : plural(segments.length, 'segment', 'segments');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 0 20mm 0;
    @bottom-left {
      content: "Voice \\00B7  on-device transcript";
      font: 500 8pt ${FONT};
      color: ${C.labelTertiary};
      padding-left: ${PAGE_X}px;
      vertical-align: top;
      padding-top: 6mm;
    }
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font: 500 8pt ${FONT};
      color: ${C.labelTertiary};
      padding-right: ${PAGE_X}px;
      vertical-align: top;
      padding-top: 6mm;
    }
  }
  /* The first page starts at the very top so the ambient blobs can bleed off the corner. */
  @page :first { margin-top: 0; }

  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: ${FONT};
    color: ${C.label};
    font-size: 11.5pt;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .doc { position: relative; padding: 0 ${PAGE_X}px; }

  /* Ambient pastel light, like <AmbientBackground>: soft radial blobs that fade to transparent. */
  .ambient { position: absolute; top: 0; right: 0; width: 640px; height: 620px; overflow: hidden; pointer-events: none; z-index: 0; }
  .blob { position: absolute; border-radius: 50%; }
  .blob-a { width: 420px; height: 420px; top: -170px; right: -110px; background: radial-gradient(circle at center, ${C.blobA} 0%, rgba(255,214,211,0.55) 38%, rgba(255,214,211,0) 70%); }
  .blob-b { width: 380px; height: 380px; top: -40px; right: 120px; background: radial-gradient(circle at center, ${C.blobB} 0%, rgba(214,232,255,0.5) 40%, rgba(214,232,255,0) 70%); }
  .blob-c { width: 340px; height: 340px; top: 90px; right: -120px; background: radial-gradient(circle at center, ${C.blobC} 0%, rgba(237,227,255,0.5) 40%, rgba(237,227,255,0) 70%); }
  .content { position: relative; z-index: 1; }

  .brand { display: flex; align-items: center; justify-content: space-between; padding-top: 15mm; }
  .brand-name { display: flex; align-items: center; gap: 9px; font: 700 15pt/1 ${FONT_DISPLAY}; letter-spacing: -0.2px; }
  .brand-name svg { display: block; }
  .brand-kind { font-size: 7.5pt; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: ${C.labelSecondary};
    padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.7); border: 1px solid ${C.hairline}; }

  h1 { font: 700 27pt/1.12 ${FONT_DISPLAY}; letter-spacing: -0.6px; margin: 34px 0 0; max-width: 92%; overflow-wrap: anywhere; }
  .subtitle { margin: 8px 0 0; font-size: 11pt; color: ${C.labelSecondary}; }

  .chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 18px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px 5px 9px; border-radius: 999px; font-size: 8.5pt; font-weight: 600;
    line-height: 1.2; white-space: nowrap; color: #3C3C43; background: rgba(255,255,255,0.78); border: 1px solid ${C.hairline};
    box-shadow: 0 1px 2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.9); font-variant-numeric: tabular-nums; }
  .chip svg { display: block; flex: none; color: ${C.labelSecondary}; }
  .chip-success { color: ${C.successText}; background: ${C.successSoft}; border-color: rgba(52,199,89,0.18); box-shadow: none; }
  .chip-success svg { color: ${C.successText}; }
  .chip-warning { color: ${C.warningText}; background: ${C.warningSoft}; border-color: rgba(255,159,10,0.2); box-shadow: none; }
  .chip-warning svg { color: ${C.warningText}; }

  .wave-card { margin-top: 24px; padding: 16px 20px 11px; border-radius: 18px; background: rgba(255,255,255,0.72);
    border: 1px solid ${C.hairline}; box-shadow: 0 6px 20px rgba(15,23,42,0.05), inset 0 1px 0 #fff; break-inside: avoid; }
  .wave { display: block; }
  .wave-times { display: flex; justify-content: space-between; margin-top: 8px; font: 500 8pt ${FONT_MONO}; color: ${C.labelSecondary};
    font-variant-numeric: tabular-nums; }

  .section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 34px 0 6px; padding-bottom: 10px;
    border-bottom: 1px solid ${C.separator}; break-after: avoid; }
  h2 { font: 700 15pt/1.2 ${FONT_DISPLAY}; letter-spacing: -0.2px; margin: 0; }
  .section-meta { font-size: 9pt; color: ${C.labelSecondary}; font-variant-numeric: tabular-nums; }

  .segments { list-style: none; margin: 0; padding: 0; }
  .segment { display: flex; align-items: flex-start; gap: 18px; padding: 11px 0; border-bottom: 1px solid ${C.separator};
    break-inside: avoid; page-break-inside: avoid; }
  .segment:last-child { border-bottom: none; }
  .time { flex: none; width: 62px; text-align: center; margin-top: 1px; padding: 3px 0; border-radius: 999px;
    font: 600 8.5pt/1.35 ${FONT_MONO}; font-variant-numeric: tabular-nums; letter-spacing: 0.2px; color: ${C.tint}; background: ${C.tintSoft}; }
  .text { margin: 0; flex: 1; min-width: 0; font-size: 11pt; line-height: 1.6; color: #1C1C21; overflow-wrap: anywhere; orphans: 3; widows: 3; }

  .end { display: flex; align-items: center; gap: 12px; margin: 26px 0 0; font-size: 8pt; font-weight: 600; letter-spacing: 1.2px;
    text-transform: uppercase; color: ${C.labelTertiary}; break-inside: avoid; }
  .end span { flex: 1; height: 1px; background: ${C.separator}; }

  .notice { display: flex; gap: 14px; align-items: flex-start; margin-top: 18px; padding: 18px 20px; border-radius: 16px;
    background: ${C.warningSoft}; color: ${C.warningText}; break-inside: avoid; }
  .notice-icon svg { display: block; width: 20px; height: 20px; margin-top: 1px; }
  .notice-title { margin: 0; font-weight: 700; font-size: 12pt; color: ${C.label}; }
  .notice-text { margin: 4px 0 0; font-size: 10.5pt; line-height: 1.5; color: #3C3C43; }

  @media screen {
    body { background: #E9EBEF; }
    .doc { width: 794px; min-height: 1123px; margin: 24px auto; background: #fff; padding-bottom: 72px; overflow: hidden;
      box-shadow: 0 10px 40px rgba(15,23,42,0.12); }
  }
</style>
</head>
<body>
  <div class="doc">
    <div class="ambient" aria-hidden="true"><div class="blob blob-b"></div><div class="blob blob-c"></div><div class="blob blob-a"></div></div>
    <main class="content">
      <header class="brand">
        <div class="brand-name">${BRAND_MARK}<span>Voice</span></div>
        <div class="brand-kind">Transcript</div>
      </header>

      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(longDate)}</p>
      <div class="chips">${chips}</div>

      ${waveCard}

      <div class="section-head"><h2>Transcript</h2><span class="section-meta">${sectionMeta}</span></div>
      ${body}
    </main>
  </div>
</body>
</html>`;
}
