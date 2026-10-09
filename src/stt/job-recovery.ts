import type { Recording } from '@/data/recordings';

/**
 * Crash-loop protection for the background transcription (pure, unit-testable).
 *
 * A job that gets the process killed (out of memory on a low-RAM phone) leaves its recording in
 * 'processing'. The worker counts every start in `transcriptAttempts` and writes it to disk before
 * the native call, so after `MAX_ATTEMPTS` starts that never finished the job is failed instead of
 * being restarted on every launch.
 */
export const MAX_ATTEMPTS = 2;

export const CRASH_LOOP_MESSAGE =
  'Transcription stopped unexpectedly twice. Try a smaller speech model in Profile, or a shorter recording.';

/** True when a 'processing' recording has used up its attempts without finishing. */
export function hasExhaustedAttempts(r: Pick<Recording, 'transcriptStatus' | 'transcriptAttempts'>): boolean {
  return r.transcriptStatus === 'processing' && (r.transcriptAttempts ?? 0) >= MAX_ATTEMPTS;
}

/** Patch that fails a crash-looping job. Partial progress is kept, so a Retry can resume it. */
export function crashLoopPatch(): Partial<Recording> {
  return { transcriptStatus: 'failed', transcriptProgress: undefined, transcriptError: CRASH_LOOP_MESSAGE };
}

/** Patch for Retry / Transcribe: queue the job again with a fresh attempt budget. */
export function retryPatch(): Partial<Recording> {
  return { transcriptStatus: 'processing', transcriptError: undefined, transcriptAttempts: undefined };
}

/** Patch for Cancel: back to 'none' (so Transcribe is offered again), dropping all job state. */
export function cancelPatch(): Partial<Recording> {
  return {
    transcriptStatus: 'none',
    transcriptProgress: undefined,
    transcriptError: undefined,
    transcriptAttempts: undefined,
    transcriptPartial: undefined,
  };
}

/** Patch for a finished job. */
export function donePatch(transcript: Recording['transcript']): Partial<Recording> {
  return {
    transcript,
    transcriptStatus: 'done',
    transcriptProgress: undefined,
    transcriptError: undefined,
    transcriptAttempts: undefined,
    transcriptPartial: undefined,
  };
}
