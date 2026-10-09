/** Native: recordings are WAV files on disk (see recording-files.ts); there is no web audio store. */

export function isStoredWebAudio(_uri: string | null | undefined): boolean {
  return false;
}

export async function persistWebAudio(_id: string, tempUri: string): Promise<string> {
  return tempUri;
}

export async function resolveWebAudio(uri: string): Promise<{ url: string; revoke: boolean } | null> {
  return { url: uri, revoke: false };
}

export function deleteWebAudio(_uri: string | null | undefined): void {}
