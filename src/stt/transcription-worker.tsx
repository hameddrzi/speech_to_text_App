import { useEffect, useRef, useState } from 'react';

import { transcribeFile } from '@/stt/engine';
import { crashLoopPatch, donePatch, hasExhaustedAttempts } from '@/stt/job-recovery';
import { STT_SUPPORTED } from '@/stt/model-files';
import { TranscriptionCancelledError } from '@/stt/types';
import { useSelectedModelReady } from '@/stt/use-model-download';
import { useRecordings } from '@/store/recordings';
import { useSettings } from '@/store/settings';

/**
 * Puts the latest state on disk before a heavy native call. The store debounces its writes, and its
 * `flush()` writes the latest *committed* state, which the store records in its own effect, after
 * this child component's effects. So one macrotask is awaited first (React has then run the store's
 * effect), then flush() writes synchronously.
 */
async function persistNow(flush: () => void): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    flush();
  } catch {
    // Best effort: the regular debounced write still happens.
  }
}

/**
 * Background job runner mounted once at the root: every recording with transcriptStatus 'processing'
 * is transcribed on device (one at a time, oldest first) and gets its time-coded segments.
 * Retry buttons only need to set the status back to 'processing' (see retryPatch).
 * Without a downloaded model, jobs simply wait and start as soon as the model is installed.
 *
 * Crash safety: each start is counted in `transcriptAttempts`, and that count is on disk before the
 * native call begins. A recording still 'processing' with MAX_ATTEMPTS used (the app was killed
 * mid-job, twice) is failed instead of restarted, so an out-of-memory job can't crash every launch.
 * Long recordings also save finished chunks in `transcriptPartial` and resume from there.
 *
 * Cancel: setting the active recording to anything but 'processing' (or deleting it) aborts the job.
 */
export function TranscriptionWorker() {
  const { recordings, updateRecording, flush } = useRecordings();
  const { settings } = useSettings();
  const modelReady = useSelectedModelReady();
  const active = useRef<{ id: string; controller: AbortController } | null>(null);
  /** A job whose attempt count was just bumped; it starts once that update is committed. */
  const pending = useRef<{ id: string; attempt: number } | null>(null);
  // Bumped when a job ends without a store change (cancel), so the next queued job is picked up.
  const [, setFinished] = useState(0);

  const next = recordings
    .filter((r) => r.transcriptStatus === 'processing')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  // Cancel: the running recording left 'processing' (Cancel button) or was deleted.
  useEffect(() => {
    const job = active.current;
    if (!job) return;
    const r = recordings.find((x) => x.id === job.id);
    if (!r || r.transcriptStatus !== 'processing') job.controller.abort();
  }, [recordings]);

  useEffect(() => {
    if (!next || active.current) return;
    const { id, uri } = next;

    if (!STT_SUPPORTED || !uri) {
      updateRecording(id, {
        transcriptStatus: 'failed',
        transcriptError: STT_SUPPORTED
          ? 'This recording has no audio file to transcribe.'
          : 'Transcription runs on your phone. Open the mobile app to transcribe recordings.',
      });
      return;
    }
    if (!modelReady) return;

    const attempts = next.transcriptAttempts ?? 0;
    const wait = pending.current?.id === id ? pending.current : null;

    if (!wait || (attempts !== wait.attempt && attempts !== wait.attempt - 1)) {
      // Not started in this session: it was killed mid-job MAX_ATTEMPTS times already.
      if (hasExhaustedAttempts(next)) {
        pending.current = null;
        updateRecording(id, crashLoopPatch());
        return;
      }
      // Step 1: count the attempt. The job starts on the render that has it committed.
      pending.current = { id, attempt: attempts + 1 };
      updateRecording(id, { transcriptAttempts: attempts + 1, transcriptProgress: 0, transcriptError: undefined });
      return;
    }
    if (attempts !== wait.attempt) return; // the update isn't committed yet

    // Step 2: the attempt is in state; make sure it is on disk before the heavy native call.
    pending.current = null;
    const controller = new AbortController();
    active.current = { id, controller };
    const model = settings.speechModel;
    const partial = next.transcriptPartial;
    const resume = partial && partial.model === model ? partial : undefined;
    let lastReported = 0;

    const finish = (patch?: Parameters<typeof updateRecording>[1]) => {
      active.current = null;
      if (patch) updateRecording(id, patch);
      setFinished((n) => n + 1);
    };

    persistNow(flush)
      .then(() =>
        transcribeFile(uri, {
          model,
          signal: controller.signal,
          resume: resume && { segments: resume.segments, nextOffsetSec: resume.nextOffsetSec },
          onChunk: (p) => {
            if (controller.signal.aborted) return;
            updateRecording(id, { transcriptPartial: { ...p, model } });
            // Saved right away, so a job killed during the next chunk resumes after this one.
            persistNow(flush);
          },
          onProgress: (p) => {
            if (controller.signal.aborted || (p - lastReported < 0.05 && p < 1)) return;
            lastReported = p;
            updateRecording(id, { transcriptProgress: p });
          },
        }),
      )
      // A cancelled job leaves the recording as the Cancel button set it (cancelPatch), or as the
      // user re-queued it since, so nothing is written for it.
      .then((transcript) => finish(controller.signal.aborted ? undefined : donePatch(transcript)))
      .catch((e: unknown) => {
        if (e instanceof TranscriptionCancelledError || controller.signal.aborted) {
          finish();
          return;
        }
        finish({
          transcriptStatus: 'failed',
          transcriptProgress: undefined,
          transcriptError: e instanceof Error ? e.message : 'Transcription failed.',
        });
      });
  }, [next, modelReady, settings.speechModel, updateRecording, flush]);

  return null;
}
