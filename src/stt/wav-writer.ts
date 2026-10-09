import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { BYTES_PER_SECOND } from '@/stt/pcm';
import { headerPatches, WAV_HEADER_BYTES, wavHeader } from '@/stt/wav-format';

/**
 * The header's length fields are rewritten after this much new audio. If the app is killed, the file is
 * still a valid WAV covering all but the last ~2 s; orphan recovery then fixes the lengths from the file size.
 */
export const HEADER_PATCH_BYTES = 2 * BYTES_PER_SECOND;

/** Names (without `.wav`) of files a WavWriter is writing right now; orphan recovery must leave them alone. */
const activeNames = new Set<string>();

export function isWavBeingWritten(name: string): boolean {
  return activeNames.has(name);
}

export function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Streams 16 kHz mono PCM straight to documents/recordings/<name>.wav while recording, so long takes
 * never sit in memory. The header's two length fields are patched every ~2 s of audio (two 4-byte
 * writes), so the file on disk is always a valid WAV up to the last patch even if the process dies;
 * finish() writes the exact final lengths.
 */
export class WavWriter {
  readonly file: File;
  readonly name: string;
  private handle: ReturnType<File['open']>;
  private dataBytes = 0;
  private patchedBytes = 0;
  private closed = false;

  constructor(name: string) {
    this.name = name;
    this.file = new File(recordingsDir(), `${name}.wav`);
    if (this.file.exists) this.file.delete();
    this.file.create();
    this.handle = this.file.open(FileMode.ReadWrite);
    this.handle.writeBytes(wavHeader(0));
    activeNames.add(name);
  }

  append(pcm: Uint8Array): void {
    if (this.closed) return;
    this.handle.writeBytes(pcm);
    this.dataBytes += pcm.byteLength;
    if (this.dataBytes - this.patchedBytes >= HEADER_PATCH_BYTES) this.patchHeader();
  }

  get seconds(): number {
    return this.dataBytes / BYTES_PER_SECOND;
  }

  /** Rewrites the RIFF and data lengths in place, then returns to the end of the file. */
  private patchHeader(): void {
    try {
      for (const [offset, bytes] of headerPatches(this.dataBytes)) {
        this.handle.offset = offset;
        this.handle.writeBytes(bytes);
      }
      this.patchedBytes = this.dataBytes;
    } finally {
      this.handle.offset = WAV_HEADER_BYTES + this.dataBytes;
    }
  }

  /** Finalizes the header and closes the file; returns its uri. Safe to call twice. */
  finish(): string {
    if (!this.closed) {
      this.closed = true;
      try {
        this.handle.offset = 0;
        this.handle.writeBytes(wavHeader(this.dataBytes));
      } finally {
        try {
          this.handle.close();
        } catch {}
        activeNames.delete(this.name);
      }
    }
    return this.file.uri;
  }

  /** Closes and deletes the partial file. */
  discard(): void {
    this.closed = true;
    activeNames.delete(this.name);
    try {
      this.handle.close();
    } catch {}
    try {
      this.file.delete();
    } catch {}
  }
}
