/** Metering floor (dBFS). Anything quieter than this is drawn as silence. */
const METER_FLOOR_DB = -55;

/** Convert a metering value in dBFS (≈ -160…0) to a perceptual 0–1 amplitude. */
export function dbToLevel(db: number | undefined | null): number {
  if (db == null || !Number.isFinite(db)) return 0;
  const x = Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
  return Math.pow(x, 1.35);
}

/** Fast attack, slower release — makes bars feel like Voice Memos instead of jittery noise. */
export function smoothLevel(prev: number, next: number): number {
  const k = next > prev ? 0.7 : 0.35;
  return prev + (next - prev) * k;
}

/** Plausible speech-like amplitude for platforms without a real meter (browser demo). */
export function simulatedLevel(elapsedMs: number): number {
  const t = elapsedMs / 1000;
  const phrase = 0.5 + 0.5 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1);
  const syllable = 0.55 + 0.45 * Math.abs(Math.sin(t * 9.1));
  const noise = 0.6 + Math.random() * 0.4;
  const pause = Math.sin(t * 0.31) > 0.85 ? 0.08 : 1;
  return Math.min(1, Math.max(0.03, phrase * syllable * noise * pause));
}

/** Downsample collected meter levels into `count` normalized (0–1) values for the stored waveform. */
export function downsampleLevels(levels: number[], count = 90): number[] {
  const n = levels.length;
  if (n === 0) return Array.from({ length: count }, () => 0.08);

  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * n) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / count));
    let sum = 0;
    let max = 0;
    for (let j = start; j < end && j < n; j++) {
      sum += levels[j];
      if (levels[j] > max) max = levels[j];
    }
    const avg = sum / Math.max(1, Math.min(end, n) - start);
    out.push(avg * 0.6 + max * 0.4);
  }

  const peak = Math.max(...out, 0.0001);
  return out.map((v) => Math.max(0.06, Math.min(1, v / peak)));
}
