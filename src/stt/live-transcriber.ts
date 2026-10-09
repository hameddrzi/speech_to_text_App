import { isEngineBusy, transcribePcmIfIdle } from '@/stt/engine';
import { BYTES_PER_SECOND, PcmBuffer } from '@/stt/pcm';
import type { PcmTuning, SttRequest } from '@/stt/types';

/** Shortest gap between two preview passes. */
const MIN_TICK_MS = 1500;
/** The next pass waits this many times as long as the last one took, so a slow phone isn't kept at 100 %. */
const SLOWDOWN = 1.5;
/** Minimum audio before the first preview. */
const MIN_SECONDS = 1;
/** When the open window reaches this length its text is committed and the window restarts. */
const COMMIT_SECONDS = 20;
/**
 * Hard cap on buffered audio. Only reached when the engine stays busy (a long file transcription running
 * in the background): the oldest audio is then dropped and the text gets a "…" where the gap is.
 */
const MAX_WINDOW_SECONDS = 30;
/** How much of the newest audio is kept when the cap is hit. */
const KEEP_AFTER_GAP_SECONDS = 10;
const GAP_MARK = '…';

/**
 * Decoder settings for preview passes: two threads (the microphone, UI and WAV writer keep the rest),
 * greedy decoding with no temperature-fallback retries. The final transcript uses the full settings.
 */
export const PREVIEW_TUNING: PcmTuning = { maxThreads: 2, temperatureInc: 0, bestOf: 1 };

/**
 * Rolling live preview while recording: the current window is re-transcribed every ≥1.5 s (adaptive to
 * how long a pass takes), and committed once it gets long, so the text grows smoothly without
 * re-processing the whole take. The accurate, time-coded transcript is produced afterwards from the WAV.
 */
export class LiveTranscriber {
  private window = new PcmBuffer();
  private committed = '';
  private partial = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inflight = false;
  private stopped = false;
  private nextDelay = MIN_TICK_MS;
  /** Bumped whenever audio is dropped, so a pass that started before the drop is ignored. */
  private generation = 0;

  constructor(
    private readonly req: SttRequest,
    private readonly onText: (text: string) => void,
    private readonly onError?: (error: Error) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.running = true;
    this.schedule(this.nextDelay);
  }

  /** Feed raw 16 kHz mono PCM. */
  push(chunk: Uint8Array): void {
    if (this.stopped) return;
    this.window.append(chunk);
    if (this.window.seconds > MAX_WINDOW_SECONDS) this.skipAhead();
  }

  /** Stops ticking (e.g. on pause) but keeps the text. */
  pause(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  stop(): void {
    this.stopped = true;
    this.pause();
    this.window.clear();
  }

  get text(): string {
    return [this.committed, this.partial].filter(Boolean).join(' ');
  }

  /** The preview fell too far behind: keep the text so far, mark the gap, keep only the newest audio. */
  private skipAhead(): void {
    this.committed = [this.text, GAP_MARK].filter(Boolean).join(' ');
    this.partial = '';
    this.window.dropHead(this.window.byteLength - KEEP_AFTER_GAP_SECONDS * BYTES_PER_SECOND);
    this.generation += 1;
    this.onText(this.text);
  }

  private schedule(ms: number): void {
    if (this.timer || !this.running || this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, ms);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.stopped) return;
    // Busy (our own pass or a file job): don't even copy the window, just look again later.
    if (this.inflight || this.window.seconds < MIN_SECONDS || isEngineBusy()) {
      this.schedule(MIN_TICK_MS);
      return;
    }
    this.inflight = true;
    const generation = this.generation;
    const snapshot = this.window.snapshot();
    const snapshotSeconds = snapshot.byteLength / BYTES_PER_SECOND;
    const startedAt = Date.now();
    try {
      const text = await transcribePcmIfIdle(snapshot, this.req, PREVIEW_TUNING);
      this.nextDelay = text === null ? MIN_TICK_MS : Math.max(MIN_TICK_MS, SLOWDOWN * (Date.now() - startedAt));
      if (text === null || this.stopped || generation !== this.generation) return;
      this.partial = text;
      if (snapshotSeconds >= COMMIT_SECONDS) {
        this.committed = this.text;
        this.partial = '';
        this.window.dropHead(snapshot.byteLength);
      }
      this.onText(this.text);
    } catch (e) {
      this.onError?.(e instanceof Error ? e : new Error(String(e)));
      this.pause();
    } finally {
      this.inflight = false;
      this.schedule(this.nextDelay);
    }
  }
}
