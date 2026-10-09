/**
 * Pure helpers for transcribing long WAV files in chunks (no React Native imports, so they can be
 * unit-tested with plain Node / tsx).
 *
 * Why: whisper.rn's `transcribe(path)` reads the whole WAV, converts it to float32 and builds the
 * mel spectrogram of the entire file before decoding, even when `offset` / `duration` are set
 * (they only move whisper.cpp's seek window). A 2-hour take therefore needs well over 1 GB of RAM.
 * Long files are instead read in ~5-minute slices and fed to `transcribeData()` one at a time.
 */

/** Whisper input: 16 kHz mono 16-bit PCM. */
export const SAMPLE_RATE = 16_000;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2;

/** Files longer than this are chunked; shorter ones keep the single whole-file call. */
export const CHUNK_THRESHOLD_SEC = 6 * 60;
/** Nominal chunk length: 5 min of 16 kHz int16 = 9.6 MB of PCM. */
export const CHUNK_SEC = 5 * 60;
/** Each chunk also reads this much audio before its nominal start, so words cut at the boundary are heard whole. */
export const OVERLAP_SEC = 1.5;
/** A tail shorter than this is folded into the previous chunk instead of becoming its own tiny chunk. */
export const MIN_TAIL_SEC = 30;
/** Tolerance when comparing segment times across a chunk boundary. */
export const BOUNDARY_EPSILON_SEC = 0.25;
/** Characters of the previous text passed as Whisper's `prompt` to keep context across chunks. */
export const PROMPT_CHARS = 200;

export type TimedSegment = { start: number; end: number; text: string };

export type WavLayout = {
  /** Byte offset of the first PCM sample. */
  dataOffset: number;
  /** Bytes of PCM data actually present in the file. */
  dataBytes: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
};

export type ChunkPlan = {
  index: number;
  /** Nominal start (s): segments before this belong to the previous chunk. */
  startSec: number;
  /** Where reading starts (s): `startSec` minus the overlap, never before 0. */
  readStartSec: number;
  endSec: number;
};

const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/**
 * Finds the PCM data in a RIFF/WAVE header. `head` is the first bytes of the file (4 KB is plenty),
 * `fileSize` its full size. A WAV whose header was never patched (the app died while recording)
 * claims 0 data bytes; the real length is then whatever follows the header.
 */
export function parseWavHeader(head: Uint8Array, fileSize: number): WavLayout {
  if (head.length < 12 || ascii(head, 0) !== 'RIFF' || ascii(head, 8) !== 'WAVE') {
    throw new Error('This recording is not a valid WAV file.');
  }
  let sampleRate = SAMPLE_RATE;
  let channels = 1;
  let bitsPerSample = 16;
  let at = 12;
  while (at + 8 <= head.length) {
    const id = ascii(head, at);
    const size = u32(head, at + 4);
    const body = at + 8;
    if (id === 'fmt ' && body + 16 <= head.length) {
      channels = u16(head, body + 2);
      sampleRate = u32(head, body + 4);
      bitsPerSample = u16(head, body + 14);
    } else if (id === 'data') {
      const available = Math.max(0, fileSize - body);
      const dataBytes = size === 0 || size > available ? available : size;
      return { dataOffset: body, dataBytes: dataBytes - (dataBytes % 2), sampleRate, channels, bitsPerSample };
    }
    at = body + size + (size % 2);
  }
  throw new Error('This recording has no audio data.');
}

export function durationSec(layout: WavLayout): number {
  return layout.dataBytes / (layout.sampleRate * layout.channels * (layout.bitsPerSample / 8));
}

/**
 * Splits [fromSec, totalSec) into chunks of about `chunkSec`. Each chunk reads `overlapSec` of audio
 * before its nominal start (except at `fromSec` = 0); a short tail is merged into the last chunk.
 */
export function planChunks(
  totalSec: number,
  fromSec = 0,
  chunkSec = CHUNK_SEC,
  overlapSec = OVERLAP_SEC,
  minTailSec = MIN_TAIL_SEC,
): ChunkPlan[] {
  const chunks: ChunkPlan[] = [];
  let start = Math.max(0, fromSec);
  while (start < totalSec - 1e-6) {
    let end = Math.min(totalSec, start + chunkSec);
    if (totalSec - end < minTailSec) end = totalSec;
    chunks.push({ index: chunks.length, startSec: start, readStartSec: Math.max(0, start - overlapSec), endSec: end });
    start = end;
  }
  return chunks;
}

/** Byte range of a chunk inside the WAV, aligned to whole 16-bit samples. */
export function chunkByteRange(chunk: ChunkPlan, layout: WavLayout): { offset: number; length: number } {
  const bytesPerSec = layout.sampleRate * layout.channels * (layout.bitsPerSample / 8);
  const align = (n: number) => n - (n % 2);
  const from = align(Math.round(chunk.readStartSec * bytesPerSec));
  const to = Math.min(layout.dataBytes, align(Math.round(chunk.endSec * bytesPerSec)));
  return { offset: layout.dataOffset + from, length: Math.max(0, to - from) };
}

/** Shifts chunk-relative segment times to times in the whole recording. */
export function offsetSegments<T extends TimedSegment>(segments: T[], offsetSec: number): T[] {
  return segments.map((s) => ({ ...s, start: s.start + offsetSec, end: s.end + offsetSec }));
}

/**
 * Drops segments of the next chunk that repeat audio the previous chunks already covered
 * (they start before the last kept segment ends, minus a small tolerance).
 */
export function dropOverlap<T extends TimedSegment>(
  previous: TimedSegment[],
  next: T[],
  epsilon = BOUNDARY_EPSILON_SEC,
): T[] {
  const lastEnd = previous.length ? previous[previous.length - 1].end : -Infinity;
  return next.filter((s) => s.start >= lastEnd - epsilon);
}

/** The tail of the text so far, cut at a word boundary, used as Whisper's prompt for the next chunk. */
export function promptFromSegments(segments: TimedSegment[], maxChars = PROMPT_CHARS): string {
  const text = segments
    .map((s) => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxChars) return text;
  const tail = text.slice(-maxChars);
  const space = tail.indexOf(' ');
  return space >= 0 ? tail.slice(space + 1) : tail;
}

/**
 * Overall 0–1 progress. Without a resume point it is (chunkIndex + chunkProgress) / chunkCount;
 * after a resume the work already done (`fromSec`) counts as finished.
 */
export function overallProgress(
  chunkIndex: number,
  chunkProgress: number,
  chunkCount: number,
  fromSec = 0,
  totalSec = 0,
): number {
  if (chunkCount <= 0) return 1;
  const share = (chunkIndex + Math.min(1, Math.max(0, chunkProgress))) / chunkCount;
  if (fromSec <= 0 || totalSec <= 0) return share;
  const done = Math.min(1, fromSec / totalSec);
  return done + (1 - done) * share;
}
