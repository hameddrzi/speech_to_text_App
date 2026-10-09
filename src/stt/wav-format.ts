/**
 * Pure helpers for the app's WAV files (16 kHz · mono · 16-bit PCM with the canonical 44-byte header).
 * No file I/O here, so the logic can be unit-checked outside React Native.
 */
import { BYTES_PER_SECOND, SAMPLE_RATE } from '@/stt/pcm';

export const WAV_HEADER_BYTES = 44;
/** Byte offsets of the two length fields that change as audio is appended. */
export const RIFF_SIZE_OFFSET = 4;
export const DATA_SIZE_OFFSET = 40;

/** The complete 44-byte header for `dataBytes` of PCM. */
export function wavHeader(dataBytes: number): Uint8Array {
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const v = new DataView(header.buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(RIFF_SIZE_OFFSET, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, BYTES_PER_SECOND, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  v.setUint32(DATA_SIZE_OFFSET, dataBytes, true);
  return header;
}

/** A little-endian uint32, for patching one length field in place. */
export function uint32LE(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

/** The two length-field patches for `dataBytes` of audio: `[offset, bytes]` pairs. */
export function headerPatches(dataBytes: number): [number, Uint8Array][] {
  return [
    [RIFF_SIZE_OFFSET, uint32LE(36 + dataBytes)],
    [DATA_SIZE_OFFSET, uint32LE(dataBytes)],
  ];
}

/** PCM bytes a file of `fileSize` bytes really holds (whole 16-bit samples only). */
export function dataBytesForFileSize(fileSize: number): number {
  const data = Math.max(0, fileSize - WAV_HEADER_BYTES);
  return data - (data % 2);
}

export function secondsForDataBytes(dataBytes: number): number {
  return dataBytes / BYTES_PER_SECOND;
}

/** True if `header` starts like a WAV written by this app (RIFF/WAVE, PCM, 16 kHz mono 16-bit). */
export function isAppWavHeader(header: Uint8Array): boolean {
  if (header.byteLength < WAV_HEADER_BYTES) return false;
  const text = (offset: number, len: number) => String.fromCharCode(...header.subarray(offset, offset + len));
  const v = new DataView(header.buffer, header.byteOffset, WAV_HEADER_BYTES);
  return (
    text(0, 4) === 'RIFF' &&
    text(8, 4) === 'WAVE' &&
    text(12, 4) === 'fmt ' &&
    text(36, 4) === 'data' &&
    v.getUint16(20, true) === 1 &&
    v.getUint16(22, true) === 1 &&
    v.getUint32(24, true) === SAMPLE_RATE &&
    v.getUint16(34, true) === 16
  );
}

/** The data length the header claims (0 when the writer never got to patch it). */
export function headerDataBytes(header: Uint8Array): number {
  return new DataView(header.buffer, header.byteOffset, WAV_HEADER_BYTES).getUint32(DATA_SIZE_OFFSET, true);
}

/**
 * Header repair for a file cut short (the app was killed mid-take): returns the corrected header for a
 * file of `fileSize` bytes, or null when the header already matches or the file isn't one of ours.
 */
export function repairHeader(header: Uint8Array, fileSize: number): Uint8Array | null {
  if (!isAppWavHeader(header)) return null;
  const data = dataBytesForFileSize(fileSize);
  if (headerDataBytes(header) === data) return null;
  return wavHeader(data);
}

/**
 * Byte offsets to sample for a cheap waveform: `bars` evenly spaced windows of `windowBytes` across the
 * data chunk (each aligned to a whole sample). Empty when there is less audio than one window.
 */
export function waveformProbeOffsets(dataBytes: number, bars: number, windowBytes: number): number[] {
  if (dataBytes < windowBytes || bars <= 0) return [];
  const span = dataBytes - windowBytes;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const at = bars === 1 ? 0 : Math.floor((span * i) / (bars - 1));
    out.push(WAV_HEADER_BYTES + at - (at % 2));
  }
  return out;
}
