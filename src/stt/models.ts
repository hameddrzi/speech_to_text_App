/**
 * On-device Whisper checkpoints (multilingual ggml files from the whisper.cpp model repo).
 * All of them understand Persian; bigger ones are noticeably more accurate for it.
 */

export type SpeechModel = 'tiny' | 'base' | 'small' | 'turbo';

export type ModelInfo = {
  value: SpeechModel;
  label: string;
  fileName: string;
  /** Exact download size in bytes (used for progress + storage stats). */
  bytes: number;
  hint: string;
};

const MODEL_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

export const MODELS: ModelInfo[] = [
  { value: 'tiny', label: 'Tiny', fileName: 'ggml-tiny.bin', bytes: 77_691_713, hint: 'Fastest · basic accuracy' },
  { value: 'base', label: 'Base', fileName: 'ggml-base.bin', bytes: 147_951_465, hint: 'Fast · good for clear speech' },
  {
    value: 'small',
    label: 'Small',
    fileName: 'ggml-small-q5_1.bin',
    bytes: 190_085_487,
    hint: 'Balanced · recommended for Persian',
  },
  {
    value: 'turbo',
    label: 'Turbo',
    fileName: 'ggml-large-v3-turbo-q5_0.bin',
    bytes: 574_041_195,
    hint: 'Best quality · needs a recent phone',
  },
];

export function modelInfo(model: SpeechModel): ModelInfo {
  return MODELS.find((m) => m.value === model) ?? MODELS[0];
}

export function modelUrl(model: SpeechModel): string {
  return MODEL_BASE_URL + modelInfo(model).fileName;
}

/** "190 MB" / "1.2 GB" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}
