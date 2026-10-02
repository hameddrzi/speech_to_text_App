import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { MODELS, modelInfo, modelUrl, type SpeechModel } from '@/stt/models';

/** Speech-to-text runs only in the native app (whisper.cpp); the web build is a UI preview. */
export const STT_SUPPORTED = Platform.OS !== 'web';

function modelsDir(): Directory {
  return new Directory(Paths.document, 'models');
}

export function modelFile(model: SpeechModel): File {
  return new File(modelsDir(), modelInfo(model).fileName);
}

function partFile(model: SpeechModel): File {
  return new File(modelsDir(), `${modelInfo(model).fileName}.part`);
}

/** True only for a complete checkpoint; a truncated file (e.g. from an older interrupted download) doesn't count. */
export function isModelDownloaded(model: SpeechModel): boolean {
  if (!STT_SUPPORTED) return false;
  try {
    const f = modelFile(model);
    return f.exists && f.size === modelInfo(model).bytes;
  } catch {
    return false;
  }
}

export function downloadedModels(): SpeechModel[] {
  return MODELS.filter((m) => isModelDownloaded(m.value)).map((m) => m.value);
}

/**
 * Downloads a checkpoint into documents/models. It streams into `<name>.part` and is only moved to its
 * final path once complete, so a cancelled or failed download never leaves a broken model behind.
 */
export async function downloadModel(
  model: SpeechModel,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!STT_SUPPORTED) throw new Error('Speech models can only be downloaded in the mobile app.');
  const dir = modelsDir();
  if (!dir.exists) dir.create({ intermediates: true });
  if (isModelDownloaded(model)) return;
  const target = modelFile(model);
  if (target.exists) target.delete();
  const part = partFile(model);
  if (part.exists) part.delete();
  const expected = modelInfo(model).bytes;
  try {
    await File.downloadFileAsync(modelUrl(model), part, {
      signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : expected;
        onProgress(Math.min(1, bytesWritten / total));
      },
    });
    if (part.size !== expected) throw new Error('The model download was incomplete. Please try again.');
    await part.move(target);
  } catch (e) {
    if (part.exists) part.delete();
    throw e;
  }
}

export function deleteModel(model: SpeechModel): void {
  try {
    for (const f of [modelFile(model), partFile(model)]) if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}
