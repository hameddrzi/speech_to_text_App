import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Tiny JSON persistence: `<name>.json` in the app's document directory on native, localStorage on web.
 *
 * Native writes are crash-safe (see `writeAtomic`): the new content goes to `<name>.json.tmp` first,
 * the previous good file is kept as `<name>.json.bak`, and only then is the temp file renamed into place.
 * Reads never throw. A file that exists but cannot be parsed is never overwritten: it is moved aside
 * to `<name>.corrupt-<timestamp>.json` so it can be recovered by hand, and the backup is used instead.
 */

/** Where a read got its value from. `temp` and `backup` mean the main file was missing or corrupt. */
export type ReadSource = 'main' | 'temp' | 'backup' | 'none';

export type ReadResult<T> = {
  value: T | null;
  source: ReadSource;
  /** True when a file existed but could not be read or parsed (it was moved aside, not deleted). */
  corrupt: boolean;
  /** Names of the files that were moved aside, if any. */
  setAside: string[];
  /** The main file is corrupt and could not be moved aside: the next write must not rotate it into `.bak`. */
  keepBackup?: boolean;
};

/** The few file operations the algorithm needs, on bare file names inside one directory. */
export type JsonFs = {
  exists(name: string): boolean;
  /** Throws if the file cannot be read. */
  read(name: string): string;
  /** Creates or truncates, then writes. */
  write(name: string, data: string): void;
  /** Renames `from` to `to`, replacing `to` if it exists. Need not be atomic. */
  move(from: string, to: string): void;
};

export type Validate = (value: unknown) => boolean;

const mainName = (name: string) => `${name}.json`;
const tmpName = (name: string) => `${name}.json.tmp`;
const bakName = (name: string) => `${name}.json.bak`;

type Attempt = { state: 'missing' } | { state: 'corrupt' } | { state: 'ok'; value: unknown };

function attempt(fs: JsonFs, file: string, validate?: Validate): Attempt {
  let raw: string;
  try {
    if (!fs.exists(file)) return { state: 'missing' };
    raw = fs.read(file);
  } catch {
    return { state: 'corrupt' };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || (validate && !validate(value))) return { state: 'corrupt' };
    return { state: 'ok', value };
  } catch {
    return { state: 'corrupt' };
  }
}

/** Moves an unreadable file out of the way (never deletes it). Returns the new name, or null. */
function setAside(fs: JsonFs, file: string, base: string, now: number): string | null {
  const target = `${base}.corrupt-${now}.json`;
  try {
    fs.move(file, target);
    return target;
  } catch {
    return null;
  }
}

/**
 * Reads `<name>.json`, falling back to the temp/backup copies. Pure apart from `fs`, so it is unit-testable.
 *
 * - main parses → main.
 * - main missing → `.tmp` (a complete newer write whose final rename did not happen), then `.bak`.
 * - main corrupt → it is moved aside to `<name>.corrupt-<now>.json`, then `.bak`, then `.tmp`.
 * A corrupt `.bak` is moved aside too (`<name>.bak.corrupt-<now>.json`) so the next rotation cannot drop it.
 */
export function readWithRecovery<T>(fs: JsonFs, name: string, validate?: Validate, now = Date.now()): ReadResult<T> {
  const setAsideFiles: string[] = [];
  const main = attempt(fs, mainName(name), validate);
  if (main.state === 'ok') return { value: main.value as T, source: 'main', corrupt: false, setAside: [] };

  let corrupt = main.state === 'corrupt';
  let keepBackup = false;
  if (corrupt) {
    const moved = setAside(fs, mainName(name), name, now);
    if (moved) setAsideFiles.push(moved);
    else keepBackup = true;
  }

  const bak = attempt(fs, bakName(name), validate);
  if (bak.state === 'corrupt') {
    corrupt = true;
    const moved = setAside(fs, bakName(name), `${name}.bak`, now);
    if (moved) setAsideFiles.push(moved);
  }
  const tmp = attempt(fs, tmpName(name), validate);

  const order: [Attempt, ReadSource][] =
    main.state === 'missing'
      ? [
          [tmp, 'temp'],
          [bak, 'backup'],
        ]
      : [
          [bak, 'backup'],
          [tmp, 'temp'],
        ];
  for (const [a, source] of order) {
    if (a.state === 'ok') return { value: a.value as T, source, corrupt, setAside: setAsideFiles, keepBackup };
  }
  return { value: null, source: 'none', corrupt, setAside: setAsideFiles, keepBackup };
}

/**
 * Crash-safe replace of `<name>.json`. Neither expo-file-system platform offers an atomic
 * rename-over (`moveSync({ overwrite: true })` deletes the destination first), so:
 *
 *   1. write `<name>.json.tmp`            (crash: main untouched; a torn .tmp is ignored/overwritten)
 *   2. move main → `<name>.json.bak`       (crash: main missing, but .tmp and .bak are both complete)
 *   3. move .tmp → main                    (crash: same as 2, or done)
 *
 * At every point at least one complete copy exists and `readWithRecovery` picks the newest one.
 * `keepBackup` skips step 2 (used when main is known to be corrupt and could not be moved aside,
 * so that it can never replace the good backup). Throws on failure; the caller decides whether that matters.
 */
export function writeAtomic(fs: JsonFs, name: string, raw: string, keepBackup = false): void {
  fs.write(tmpName(name), raw);
  if (!keepBackup && fs.exists(mainName(name))) fs.move(mainName(name), bakName(name));
  fs.move(tmpName(name), mainName(name));
}

// ---------------------------------------------------------------------------------------------
// Platform bindings

const documentFs: JsonFs = {
  exists: (name) => new File(Paths.document, name).exists,
  read: (name) => new File(Paths.document, name).textSync(),
  write: (name, data) => {
    const f = new File(Paths.document, name);
    if (!f.exists) f.create();
    f.write(data);
  },
  move: (from, to) => new File(Paths.document, from).moveSync(new File(Paths.document, to), { overwrite: true }),
};

/** Names whose main file has been checked (and set aside if corrupt) during this session. */
const inspected = new Set<string>();
/** Names whose corrupt main file could not be moved aside: their `.bak` must survive the next write. */
const keepBackupOnce = new Set<string>();

function readWeb<T>(name: string, validate?: Validate): ReadResult<T> {
  // localStorage.setItem is atomic, so there is no temp/backup; a corrupt value is still kept aside.
  const store = globalThis.localStorage;
  const raw = store?.getItem(name);
  if (raw == null) return { value: null, source: 'none', corrupt: false, setAside: [] };
  try {
    const value: unknown = JSON.parse(raw);
    if (value !== null && (!validate || validate(value))) {
      return { value: value as T, source: 'main', corrupt: false, setAside: [] };
    }
  } catch {}
  const key = `${name}.corrupt-${Date.now()}`;
  try {
    store?.setItem(key, raw);
    store?.removeItem(name);
    return { value: null, source: 'none', corrupt: true, setAside: [key] };
  } catch {
    return { value: null, source: 'none', corrupt: true, setAside: [] };
  }
}

/** Reads a JSON value and reports where it came from and whether anything had to be set aside. */
export function readJSONWithStatus<T>(name: string, validate?: Validate): ReadResult<T> {
  inspected.add(name);
  try {
    const result = Platform.OS === 'web' ? readWeb<T>(name, validate) : readWithRecovery<T>(documentFs, name, validate);
    if (result.keepBackup) keepBackupOnce.add(name);
    if (result.corrupt || result.source === 'temp' || result.source === 'backup') {
      console.warn(
        `[storage] ${name}: recovered from ${result.source}` +
          (result.setAside.length ? `; unreadable data kept as ${result.setAside.join(', ')}` : ''),
      );
    }
    return result;
  } catch {
    return { value: null, source: 'none', corrupt: false, setAside: [] };
  }
}

/** Reads a JSON value; `null` when there is nothing usable. Never throws. */
export function readJSON<T>(name: string, validate?: Validate): T | null {
  return readJSONWithStatus<T>(name, validate).value;
}

/** Serializes and writes a value. Best effort: a failed write is logged, never thrown. */
export function writeJSON(name: string, value: unknown): void {
  writeRawJSON(name, JSON.stringify(value));
}

/** Writes an already-serialized JSON string (lets callers skip unchanged writes). Never throws. */
export function writeRawJSON(name: string, raw: string): void {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(name, raw);
      return;
    }
    // Never rotate an unparsed main file into .bak: inspect (and set aside if corrupt) first.
    if (!inspected.has(name)) readJSONWithStatus(name);
    writeAtomic(documentFs, name, raw, keepBackupOnce.has(name));
    keepBackupOnce.delete(name);
  } catch (e) {
    // Losing one write is better than crashing the UI; the previous copy is still on disk.
    console.warn(`[storage] ${name}: write failed`, e);
  }
}
