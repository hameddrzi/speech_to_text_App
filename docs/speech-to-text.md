# On-device speech-to-text

Transcription runs fully on the phone with OpenAI's **Whisper** model, executed by
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) through the React Native binding
[`whisper.rn`](https://github.com/mybigday/whisper.rn). There is no server and no API key, and
audio never leaves the device.

All the code is in `src/stt/`.

## Two passes per recording

Every recording is transcribed twice, for two different goals:

| | Live preview | Final transcript |
|---|---|---|
| **When** | While recording | After the recording is saved |
| **Input** | The last few seconds of PCM in memory | The complete WAV file |
| **Output** | Plain text in the *Live Transcript* card | Time-coded segments stored with the recording |
| **Goal** | Instant feedback | Accuracy |
| **Code** | `live-transcriber.ts` | `transcription-worker.tsx` |

The live text can differ from the final transcript. That's expected: the final pass sees the
whole recording at once, so it has more context and is more accurate.

### Live preview: `LiveTranscriber`

- Every **1.5 s**, the current audio window is sent to Whisper (once there is at least 1 s of audio).
- When the window reaches **20 s**, its text is *committed*, the window is cleared, and a new one
  starts. This keeps each preview call short however long the recording is.
- If the engine is still busy with the previous call, the tick is simply skipped (`transcribePcmIfIdle`).
  The preview never queues up behind itself.
- Pausing stops the ticks but keeps the text. The microphone stream stays open while paused and its
  audio is dropped: on Android, `@fugood/react-native-audio-pcm-stream` releases the recorder on
  `stop()`, so a later `start()` would capture nothing.

### Final transcript: `TranscriptionWorker`

- Mounted once at the app root and renders nothing.
- Finds the **oldest** recording with `transcriptStatus: 'processing'`, transcribes its WAV file,
  and stores the segments (`{ start, end, text }` in seconds) with the recording.
- Progress is reported in 5 % steps, shown as *Transcribing n%* in the Archive.
- Errors are stored in `transcriptError` and shown next to a **Retry** button.
- If the selected model isn't downloaded, jobs wait instead of failing and start once it is installed.
- Sound tags Whisper emits for silence and noise (`[BLANK_AUDIO]`, `[Music]`, `(applause)`…) are
  removed from both the live preview and the final transcript (`cleanText` in `engine.native.ts`).
  A recording with nothing left shows *No speech detected*.
- Recordings are processed one at a time, so several new recordings simply wait their turn.
- **Cancel** (detail screen, while transcribing) stops the native job (whisper.rn's `stop()`, wired
  through an `AbortSignal` passed to `transcribeFile`) and sets the recording back to
  `transcriptStatus: 'none'`, so *Transcribe* is offered again. The worker notices the recording
  left `'processing'` (or was deleted) and aborts; it never overwrites what the user set.

#### Long recordings are transcribed in chunks

whisper.rn's `transcribe(path)` reads the **whole** WAV, converts it to float32 and builds the mel
spectrogram of the entire file before decoding (`readWaveAudio` in `cpp/jsi/RNWhisperJSI.cpp`,
`hostLoadFileBytes` in `android/src/main/jni.cpp`, `whisper_pcm_to_mel_with_state` in
`whisper_full`). Its `offset` / `duration` options don't help: they only move whisper.cpp's seek
window after everything is loaded. A 2-hour take needed 1.3–1.9 GB of RAM.

So recordings **longer than 6 minutes** are chunked (`src/stt/chunking.ts`, pure and unit-tested;
`transcribeChunked` in `engine.native.ts`):

1. Only the WAV header is read to find the PCM data (an unpatched header from a crashed recording
   falls back to the file size).
2. The audio is planned in **5-minute** chunks (a tail under 30 s joins the last chunk). Each chunk
   is read straight from disk (`File.open()` → `FileHandle.readBytes()` at an offset), starting
   **1.5 s** before its nominal start so words cut at the boundary are heard whole, and passed to
   `ctx.transcribeData()` as 16-bit PCM (9.6 MB per chunk).
3. Segment times are shifted by the chunk's read start. Segments of the new chunk that start before
   the last kept segment ends (minus 0.25 s) repeat the overlap and are dropped.
4. The last ~200 characters of text so far are passed as Whisper's `prompt`, so context carries over.
5. Progress is `(chunk index + chunk progress) / chunk count`.

Memory is now flat: about 10 MB of PCM, ~20 MB of float samples and ~10–15 MB of mel per chunk on
top of the model, whatever the length. Recordings up to 6 minutes keep the single `transcribe()`
call. The whole chunked job holds the engine lock (`exclusive`), so a live preview never runs in the
middle of a file: whisper.rn runs one job per context anyway, and holding it keeps the model loaded
for the whole file.

#### Crash and restart safety

- Before every start the worker increments `transcriptAttempts` and waits until that change is
  committed and flushed to disk (`flush()` from `useRecordings()`) before calling the engine.
- After each chunk, the finished segments are saved in `transcriptPartial`
  (`{ segments, nextOffsetSec, model }`). A job killed mid-file resumes from `nextOffsetSec` on the
  next launch (only with the same speech model; another model starts over).
- A recording found in `'processing'` with **2** attempts that never finished is set to `'failed'`
  with *"Transcription stopped unexpectedly twice. Try a smaller speech model in Profile, or a
  shorter recording."* instead of being restarted, so an out-of-memory job can't kill the app on
  every launch.
- Attempts and partial progress are cleared on success and Cancel; **Retry** resets the attempts
  (and resumes the saved chunks if the model is unchanged).

## The engine: `engine.native.ts`

whisper.rn allows **one job per model context at a time**, so the engine serializes all work:

- `transcribeFile(uri, req)`: queued behind any running job (`exclusive`). `req` also takes
  `signal` (cancel), `resume` and `onChunk` (partial progress of long files).
- `transcribePcmIfIdle(pcm, req)`: runs only if the engine is idle, otherwise returns `null`.

The loaded model (the *context*) is kept in memory and reused. When the user switches models, the
old context is released before the new one is loaded. GPU acceleration is requested (`useGpu: true`);
whisper.rn falls back to the CPU when the device can't use it.

If the selected model isn't downloaded, the engine throws `ModelMissingError`, which tells the user
to download it in **Profile → Transcription**.

`engine.ts` (no `.native`) is the web stand-in: it reports transcription as unsupported.

## Audio format

Whisper expects **16 kHz, mono, 16-bit PCM**, so the app records in exactly that format and never
needs to convert:

```
Microphone ──► base64 chunks ──► Uint8Array PCM ──┬─► WavWriter  (recordings/rec-<id>.wav)
               (pcm-stream)       (pcm.ts)         ├─► level meter (waveform)
                                                   └─► LiveTranscriber
```

- On Android the microphone uses the `VOICE_RECOGNITION` audio source, which is tuned for speech.
- The WAV is written in streaming mode, so a long recording never sits in memory.
- Size: about **1.9 MB per minute**.

## Models

Defined in `models.ts`. All are multilingual ggml checkpoints from
[huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp).

| Id | File | Size |
|---|---|---|
| `tiny` | `ggml-tiny.bin` | 78 MB |
| `base` | `ggml-base.bin` | 148 MB |
| `small` | `ggml-small-q5_1.bin` | 190 MB |
| `turbo` | `ggml-large-v3-turbo-q5_0.bin` | 574 MB |

`q5_0` / `q5_1` are 5-bit quantized versions. They are much smaller than the originals with only a
small loss in quality.

Since the app is English only, the English-only `.en` checkpoints (for example `ggml-base.en.bin`)
would also work and are slightly more accurate for English at the same size. Switching to them means
updating `fileName` and the exact `bytes` in `models.ts`.

### How downloads work (`model-files.ts`)

1. The file is downloaded to `models/<file>.part`.
2. When the download ends, the size is compared with the exact expected byte count.
3. Only then is it renamed to `models/<file>`.

A model counts as installed only if the final file exists **and** has the exact expected size.
An interrupted download therefore never leaves a broken model the engine would try to load.

### Installing a model without the app (development)

On a debug build you can copy a model over USB, which is faster than downloading on the phone:

```bash
curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
adb push ggml-small-q5_1.bin /data/local/tmp/
adb shell run-as com.voicetranscript.app sh -c \
  'mkdir -p files/models && cp /data/local/tmp/ggml-small-q5_1.bin files/models/'
adb shell rm /data/local/tmp/ggml-small-q5_1.bin
```

`run-as` only works with debug builds.

## Language

The app is **English only**. Every Whisper call passes `language: 'en'` (`OPTIONS` in
`engine.native.ts`), for both the live preview and the final transcript. There is no language
picker and no automatic detection.

## Accuracy

Accuracy depends mostly on the model size:

- **Small** works well for clear speech.
- **Turbo** (large-v3-turbo) is the most accurate and runs well on phones with 6 GB+ RAM. It is
  slower, and the download is 574 MB.

Tips that help with any model:

- Hold the phone close and record in a quiet place.
- Speak in full sentences. Whisper uses the context of the whole sentence.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| *"The Small speech model is not downloaded yet"* | Download it in **Profile → Transcription**. |
| Model download stuck | The app was sent to the background or the network dropped. Cancel and try again; the partial `.part` file is thrown away. |
| Recording shows **Waiting** | No speech model is downloaded. Download one in **Profile → Transcription**; the recording is transcribed automatically. |
| Recording shows **Retry** | The transcription failed; the reason is shown on the row. Tap Retry. |
| *"Transcription stopped unexpectedly twice"* | The app was killed twice while transcribing this recording, usually out of memory on a phone with little RAM. Pick a smaller model (Small or Base) in **Profile → Transcription** and tap Retry. Long recordings resume from the last finished 5-minute chunk. |
| Transcription takes too long | Open the recording and tap **Cancel**. It goes back to *No transcript yet*; tap Transcribe to start again, for example after switching to a smaller model. |
| Live transcript stays empty | Check that *Live Transcript* is on and a model is downloaded. The first preview appears after about 1.5–3 s while the model loads. |
| App won't install (`not enough space`) | The phone's storage is full. Free 1–2 GB; models need space too. |
