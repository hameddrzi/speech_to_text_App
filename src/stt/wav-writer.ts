import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { SAMPLE_RATE } from '@/stt/pcm';

const HEADER_BYTES = 44;

function wavHeader(dataBytes: number): Uint8Array {
  const header = new Uint8Array(HEADER_BYTES);
  const v = new DataView(header.buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // PCM chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  return header;
}

export function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Streams 16 kHz mono PCM straight to documents/recordings/<name>.wav while recording,
 * so long takes never sit in memory. The header is patched with the real sizes on finish().
 */
export class WavWriter {
  readonly file: File;
  private handle: ReturnType<File['open']>;
  private dataBytes = 0;

  constructor(name: string) {
    this.file = new File(recordingsDir(), `${name}.wav`);
    if (this.file.exists) this.file.delete();
    this.file.create();
    this.handle = this.file.open(FileMode.ReadWrite);
    this.handle.writeBytes(wavHeader(0));
  }

  append(pcm: Uint8Array): void {
    this.handle.writeBytes(pcm);
    this.dataBytes += pcm.byteLength;
  }

  get seconds(): number {
    return this.dataBytes / (SAMPLE_RATE * 2);
  }

  /** Finalizes the header and closes the file; returns its uri. */
  finish(): string {
    this.handle.offset = 0;
    this.handle.writeBytes(wavHeader(this.dataBytes));
    this.handle.close();
    return this.file.uri;
  }

  /** Closes and deletes the partial file. */
  discard(): void {
    try {
      this.handle.close();
    } catch {}
    try {
      this.file.delete();
    } catch {}
  }
}
