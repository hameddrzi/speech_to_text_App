export type TranscriptSegment = {
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  text: string;
};

export type TranscriptStatus = 'done' | 'processing' | 'failed' | 'none';

export type Recording = {
  id: string;
  title: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Seconds. */
  duration: number;
  /** Local file URI once real recording exists; null for mock data. */
  uri: string | null;
  /** Normalized 0–1 amplitudes used to draw the waveform (≈ 60–120 values). */
  waveform: number[];
  transcript: TranscriptSegment[];
  transcriptStatus: TranscriptStatus;
  favorite: boolean;
  /** 0–1 while the on-device transcription is running. */
  transcriptProgress?: number;
  /** Human-readable reason when transcriptStatus is 'failed'. */
  transcriptError?: string;
};

/** Deterministic pseudo-random waveform so mock data looks natural and stable between renders. */
export function makeWaveform(seed: number, count = 90): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => {
    const envelope = 0.55 + 0.45 * Math.sin((i / count) * Math.PI * 3 + seed);
    return Math.max(0.08, Math.min(1, envelope * (0.35 + rand() * 0.75)));
  });
}

const daysAgo = (d: number, h = 10, m = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(h, m, 0, 0);
  return date.toISOString();
};

export const MOCK_RECORDINGS: Recording[] = [
  {
    id: 'r1',
    title: 'Product team meeting',
    createdAt: daysAgo(0, 9, 42),
    duration: 184,
    uri: null,
    waveform: makeWaveform(3),
    favorite: true,
    transcriptStatus: 'done',
    transcript: [
      { start: 0, end: 12, text: 'Hi everyone, today we want to talk about the new version of the app.' },
      { start: 12, end: 31, text: 'Our first priority is making recording rock solid, so no audio is ever lost.' },
      { start: 31, end: 58, text: 'After that, the transcript should show up in the archive next to each audio file.' },
      { start: 58, end: 90, text: 'The design should be white and clean, with glass elements, like Voice Memos on the iPhone.' },
      { start: 90, end: 184, text: 'We will have a prototype ready by the end of the week, then wire up the speech-to-text core.' },
    ],
  },
  {
    id: 'r2',
    title: 'Idea — onboarding flow',
    createdAt: daysAgo(0, 8, 5),
    duration: 47,
    uri: null,
    waveform: makeWaveform(11),
    favorite: false,
    transcriptStatus: 'done',
    transcript: [
      { start: 0, end: 15, text: 'Quick idea for onboarding: ask for microphone permission only when the user taps record.' },
      { start: 15, end: 47, text: 'Then show a tiny glass card explaining that everything is transcribed on device.' },
    ],
  },
  {
    id: 'r3',
    title: 'Voice note',
    createdAt: daysAgo(1, 21, 17),
    duration: 312,
    uri: null,
    waveform: makeWaveform(23),
    favorite: false,
    transcriptStatus: 'processing',
    transcript: [],
  },
  {
    id: 'r4',
    title: 'Lecture — Signals & Systems',
    createdAt: daysAgo(3, 14, 0),
    duration: 2715,
    uri: null,
    waveform: makeWaveform(37),
    favorite: true,
    transcriptStatus: 'done',
    transcript: [
      { start: 0, end: 40, text: 'Today we continue with the Fourier transform and its properties.' },
      { start: 40, end: 120, text: 'Remember that convolution in time corresponds to multiplication in frequency.' },
      { start: 120, end: 2715, text: 'Let us work through an example with a rectangular pulse and derive its spectrum step by step.' },
    ],
  },
  {
    id: 'r5',
    title: 'Support call',
    createdAt: daysAgo(8, 16, 30),
    duration: 96,
    uri: null,
    waveform: makeWaveform(51),
    favorite: false,
    transcriptStatus: 'failed',
    transcript: [],
  },
];

export function transcriptText(r: Recording): string {
  return r.transcript.map((s) => s.text).join(' ');
}
