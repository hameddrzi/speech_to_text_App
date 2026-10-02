import { useSyncExternalStore } from 'react';

import { deleteModel, downloadedModels, downloadModel } from '@/stt/model-files';
import type { SpeechModel } from '@/stt/models';

type DownloadState = {
  downloaded: SpeechModel[];
  downloading: SpeechModel | null;
  progress: number;
  error: string | null;
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
      set({ downloading: null, progress: 0, error: e instanceof Error ? e.message : 'Download failed' });
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

function remove(model: SpeechModel) {
  deleteModel(model);
  set({ downloaded: downloadedModels() });
}

export function useModelDownload() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return { ...snapshot, start, cancel, remove };
}
