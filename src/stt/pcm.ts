/** Helpers for the 16 kHz · mono · 16-bit little-endian PCM stream Whisper expects. */

export const SAMPLE_RATE = 16000;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const len = b64.length;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(((len * 3) >> 2) - padding);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[b64.charCodeAt(i)];
    const b = LOOKUP[b64.charCodeAt(i + 1)];
    const c = LOOKUP[b64.charCodeAt(i + 2)];
    const d = LOOKUP[b64.charCodeAt(i + 3)];
    if (p < out.length) out[p++] = (a << 2) | (b >> 4);
    if (p < out.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < out.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

/** RMS loudness of a PCM chunk mapped to 0–1 on a −50…0 dBFS scale (matches the waveform's feel). */
export function pcmLevel(bytes: Uint8Array): number {
  const samples = bytes.byteLength >> 1;
  if (samples === 0) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const s = view.getInt16(i * 2, true) / 32768;
    sum += s * s;
  }
  const rms = Math.sqrt(sum / samples);
  const db = 20 * Math.log10(rms + 1e-9);
  return Math.max(0, Math.min(1, (db + 50) / 50));
}

/** Growable byte buffer for the live-transcription window. */
export class PcmBuffer {
  private data = new Uint8Array(BYTES_PER_SECOND * 4);
  private length = 0;

  get byteLength(): number {
    return this.length;
  }

  get seconds(): number {
    return this.length / BYTES_PER_SECOND;
  }

  append(chunk: Uint8Array): void {
    if (this.length + chunk.byteLength > this.data.byteLength) {
      const next = new Uint8Array(Math.max(this.data.byteLength * 2, this.length + chunk.byteLength));
      next.set(this.data.subarray(0, this.length));
      this.data = next;
    }
    this.data.set(chunk, this.length);
    this.length += chunk.byteLength;
  }

  /** Copy of the current contents. */
  snapshot(): Uint8Array {
    return this.data.slice(0, this.length);
  }

  /** Drops the first `bytes` (audio already covered by a committed transcript), keeping anything newer. */
  dropHead(bytes: number): void {
    const n = Math.min(bytes, this.length);
    this.data.copyWithin(0, n, this.length);
    this.length -= n;
  }

  clear(): void {
    this.length = 0;
  }
}
