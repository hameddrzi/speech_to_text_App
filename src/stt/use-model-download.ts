import { useSyncExternalStore } from 'react';

import { useSettings } from '@/store/settings';
import { releaseEngine } from '@/stt/engine';
import { deleteModel, downloadedModels, downloadModel } from '@/stt/model-files';
import type { SpeechModel } from '@/stt/models';

type DownloadState = {
  downloaded: SpeechModel[];
  downloading: SpeechModel | null;
  progress: number;
  /** The last failed download, so the message stays with the model it belongs to. */
  error: { model: SpeechModel; message: string } | null;
};

/**
 * Whisper model downloads, kept at module level so a download keeps running (and its progress stays visible)
 * when the user leaves the Profile tab.
 */
let state: DownloadState = { downloaded: downloadedModels(), downloading: null, progress: 0, error: null };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<DownloadState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function start(model: SpeechModel) {
  controller?.abort();
  const ctrl = new AbortController();
  controller = ctrl;
  set({ downloading: model, progress: 0, error: null });
  let last = 0;
  downloadModel(
    model,
    (p) => {
      if (p - last < 0.005 && p < 1) return;
      last = p;
      set({ progress: p });
    },
    ctrl.signal,
  )
    .then(() => set({ downloading: null, progress: 0, downloaded: downloadedModels() }))
    .catch((e: unknown) => {
      if (ctrl.signal.aborted) return;
      set({
        downloading: null,
        progress: 0,
        error: { model, message: e instanceof Error ? e.message : 'Download failed' },
      });
    })
    .finally(() => {
      if (controller === ctrl) controller = null;
    });
}

function cancel() {
  controller?.abort();
  controller = null;
  set({ downloading: null, progress: 0 });
}

/** Unloads the model first (waiting for a running transcription), so the engine never holds a deleted file. */
async function remove(model: SpeechModel) {
  await releaseEngine();
  deleteModel(model);
  set({ downloaded: downloadedModels() });
}

export function useModelDownload() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return { ...snapshot, start, cancel, remove };
}

/** Whether the speech model selected in Profile is on the device, i.e. transcription can run. */
export function useSelectedModelReady(): boolean {
  const { settings } = useSettings();
  const { downloaded } = useModelDownload();
  return downloaded.includes(settings.speechModel);
}
