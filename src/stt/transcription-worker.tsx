import { useEffect, useRef } from 'react';

import { transcribeFile } from '@/stt/engine';
import { STT_SUPPORTED } from '@/stt/model-files';
import { useRecordings } from '@/store/recordings';
import { useSettings } from '@/store/settings';

/**
 * Background job runner mounted once at the root: every recording with transcriptStatus 'processing'
 * is transcribed on device (one at a time, oldest first) and gets its time-coded segments.
 * Retry buttons only need to set the status back to 'processing'.
 */
export function TranscriptionWorker() {
  const { recordings, updateRecording } = useRecordings();
  const { settings } = useSettings();
  const activeId = useRef<string | null>(null);

  const next = recordings
    .filter((r) => r.transcriptStatus === 'processing')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  useEffect(() => {
    if (!next || activeId.current) return;
    const { id, uri, language } = next;

    if (!STT_SUPPORTED || !uri) {
      updateRecording(id, {
        transcriptStatus: 'failed',
        transcriptError: STT_SUPPORTED
          ? 'This recording has no audio file to transcribe.'
          : 'Transcription runs on your phone. Open the mobile app to transcribe recordings.',
      });
      return;
    }

    activeId.current = id;
    let lastReported = 0;
    updateRecording(id, { transcriptProgress: 0, transcriptError: undefined });

    transcribeFile(uri, {
      model: settings.speechModel,
      language,
      onProgress: (p) => {
        if (p - lastReported < 0.05 && p < 1) return;
        lastReported = p;
        updateRecording(id, { transcriptProgress: p });
      },
    })
      .then((transcript) => {
        activeId.current = null;
        updateRecording(id, { transcript, transcriptStatus: 'done', transcriptProgress: undefined });
      })
      .catch((e: unknown) => {
        activeId.current = null;
        updateRecording(id, {
          transcriptStatus: 'failed',
          transcriptProgress: undefined,
          transcriptError: e instanceof Error ? e.message : 'Transcription failed.',
        });
      });
  }, [next, settings.speechModel, updateRecording]);

  return null;
}
