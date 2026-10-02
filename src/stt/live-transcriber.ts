import { transcribePcmIfIdle } from '@/stt/engine';
import { PcmBuffer } from '@/stt/pcm';
import type { SttRequest } from '@/stt/types';

/** How often the open window is re-transcribed. */
const TICK_MS = 1500;
/** Minimum audio before the first preview. */
const MIN_SECONDS = 1;
/** When the open window reaches this length its text is committed and the window restarts. */
const COMMIT_SECONDS = 20;

/**
 * Rolling live preview while recording (same idea as Live_Transcript's live pass):
 * the current window is re-transcribed every ~1.5 s, and committed once it gets long,
 * so the text grows smoothly without re-processing the whole take.
 * The accurate, time-coded transcript is produced afterwards from the saved WAV file.
 */
export class LiveTranscriber {
  private window = new PcmBuffer();
  private committed = '';
  private partial = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight = false;
  private stopped = false;

  constructor(
    private readonly req: SttRequest,
    private readonly onText: (text: string) => void,
    private readonly onError?: (error: Error) => void,
  ) {}

  start(): void {
    this.stopped = false;
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }

  /** Feed raw 16 kHz mono PCM. */
  push(chunk: Uint8Array): void {
    if (!this.stopped) this.window.append(chunk);
  }

  /** Stops ticking (e.g. on pause) but keeps the text. */
  pause(): void {
    if (this.timer) clearInterval(this.timer);
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

  private async tick(): Promise<void> {
    if (this.inflight || this.stopped || this.window.seconds < MIN_SECONDS) return;
    this.inflight = true;
    const snapshot = this.window.snapshot();
    const snapshotSeconds = this.window.seconds;
    try {
      const text = await transcribePcmIfIdle(snapshot, this.req);
      if (text === null || this.stopped) return;
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
    }
  }
}
