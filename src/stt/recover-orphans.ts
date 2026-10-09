import { File, FileMode } from 'expo-file-system';

import { downsampleLevels } from '@/components/record/waveform-utils';
import type { Recording } from '@/data/recordings';
import { pcmLevel } from '@/stt/pcm';
import {
  dataBytesForFileSize,
  isAppWavHeader,
  repairHeader,
  secondsForDataBytes,
  WAV_HEADER_BYTES,
  waveformProbeOffsets,
} from '@/stt/wav-format';
import { isWavBeingWritten, recordingsDir } from '@/stt/wav-writer';

/** Shorter leftovers are deleted instead of recovered (an accidental tap, or a take killed right away). */
export const MIN_RECOVER_SECONDS = 0.5;
export const RECOVERED_TITLE = 'Recovered Recording';

const WAVEFORM_BARS = 90;
/** 50 ms of audio read at each waveform bar: 90 tiny reads, whatever the length of the file. */
const PROBE_BYTES = 1600;

/** Only files the recorder itself creates (`rec-<timestamp>.wav`) are ever touched. */
const TAKE_FILE = /^rec-[\w-]+\.wav$/i;

function baseName(uri: string): string {
  const last = uri.split('?')[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * File names in `names` that look like takes but belong to no recording (matched by id and by the file
 * name of its uri, so a store that rebases paths still matches), skipping files being recorded right now.
 */
export function findOrphanNames(
  names: string[],
  recordings: Pick<Recording, 'id' | 'uri'>[],
  isActive: (stem: string) => boolean = isWavBeingWritten,
): string[] {
  const known = new Set<string>();
  for (const r of recordings) {
    known.add(`${r.id}.wav`);
    if (r.uri) known.add(baseName(r.uri));
  }
  return names.filter((n) => TAKE_FILE.test(n) && !known.has(n) && !isActive(n.replace(/\.wav$/i, '')));
}

function recoverFile(file: File, name: string): Recording | null {
  const size = file.size ?? 0;
  const dataBytes = dataBytesForFileSize(size);
  const seconds = secondsForDataBytes(dataBytes);
  if (seconds < MIN_RECOVER_SECONDS) {
    file.delete();
    return null;
  }

  const handle = file.open(FileMode.ReadWrite);
  const levels: number[] = [];
  try {
    const header = handle.readBytes(WAV_HEADER_BYTES);
    // Not a file this app wrote: leave it alone rather than guess.
    if (!isAppWavHeader(header)) return null;
    const fixed = repairHeader(header, size);
    if (fixed) {
      handle.offset = 0;
      handle.writeBytes(fixed);
    }
    for (const offset of waveformProbeOffsets(dataBytes, WAVEFORM_BARS, PROBE_BYTES)) {
      handle.offset = offset;
      levels.push(pcmLevel(handle.readBytes(PROBE_BYTES)));
    }
  } finally {
    handle.close();
  }

  const modified = file.lastModified;
  return {
    id: name.replace(/\.wav$/i, ''),
    title: RECOVERED_TITLE,
    createdAt: new Date(modified && modified > 0 ? modified : Date.now()).toISOString(),
    duration: Math.max(1, Math.round(seconds)),
    uri: file.uri,
    waveform: downsampleLevels(levels, WAVEFORM_BARS),
    transcript: [],
    // The background TranscriptionWorker transcribes it like any new recording.
    transcriptStatus: 'processing',
    favorite: false,
  };
}

/**
 * Finds takes left on disk by a session that never reached "save" (app killed, crash, or the Record
 * screen torn down mid-take), repairs their WAV header from the real file size, and returns them as
 * recordings for the store to add. Files under MIN_RECOVER_SECONDS are deleted. Never throws.
 */
export function recoverOrphans(recordings: Pick<Recording, 'id' | 'uri'>[]): Recording[] {
  let files: File[];
  try {
    files = recordingsDir()
      .list()
      .filter((e): e is File => e instanceof File);
  } catch {
    return [];
  }
  const byName = new Map(files.map((f) => [f.name, f]));
  const out: Recording[] = [];
  for (const name of findOrphanNames([...byName.keys()], recordings)) {
    try {
      const rec = recoverFile(byName.get(name)!, name);
      if (rec) out.push(rec);
    } catch (e) {
      console.warn(`[recover-orphans] could not recover ${name}`, e);
    }
  }
  return out;
}
