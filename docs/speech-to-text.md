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
- Pausing stops the ticks but keeps the text.

### Final transcript: `TranscriptionWorker`

- Mounted once at the app root and renders nothing.
- Finds the **oldest** recording with `transcriptStatus: 'processing'`, transcribes its WAV file,
  and stores the segments (`{ start, end, text }` in seconds) with the recording.
- Progress is reported in 5 % steps, shown as *Transcribing n%* in the Archive.
- Errors are stored in `transcriptError` and shown next to a **Retry** button.
- Recordings are processed one at a time, so several new recordings simply wait their turn.

## The engine: `engine.native.ts`

whisper.rn allows **one job per model context at a time**, so the engine serializes all work:

- `transcribeFile(uri, req)`: queued behind any running job (`exclusive`).
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

**Never use the `.en` models** (for example `ggml-base.en.bin`). They only understand English.

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

## Languages

| Code | Language | Notes |
|---|---|---|
| `fa` | Persian | Right-to-left display |
| `en` | English | |
| `it` | Italian | |
| `auto` | Automatic | Whisper detects the language (settings only) |

For Persian and Italian a short **prompt** is passed to Whisper (`PROMPTS` in `engine.native.ts`).
Whisper treats it as text that came "before" the recording, which nudges it toward the right script
and punctuated sentences instead of transliteration.

### Adding a language

1. Add the code and display name to `RecordingLanguage` and `LANGUAGE_NAMES` in `stt/types.ts`.
2. Add it to `OPTIONS` in `components/record/language-toggle.tsx` and to `LANGUAGE_OPTIONS` in
   `store/settings.tsx`.
3. Optionally add a prompt for it in `PROMPTS` in `stt/engine.native.ts`.
4. If it is written right to left, check `isRTL` in `utils/format.ts`.

Whisper supports about 100 languages; the code must be one of
[Whisper's language codes](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py).

## Accuracy

Accuracy depends mostly on the model size:

- **Small** works for clear English speech, but makes frequent mistakes in Persian.
- **Turbo** (large-v3-turbo) is clearly better for Persian and Italian and runs well on phones with
  6 GB+ RAM. It is slower, and the download is 574 MB.

Tips that help with any model:

- **Choose the language explicitly** instead of *Auto*. On short clips, automatic detection can
  pick the wrong language.
- Hold the phone close and record in a quiet place.
- Speak in full sentences. Whisper uses the context of the whole sentence.

Planned: a word-error-rate comparison of Small, Turbo and a Persian fine-tuned Turbo
(`nezamisafa/whisper-v3-turbo-persian-v1.0`, converted to ggml) on the FLEURS Persian and
Italian test sets.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| *"The Small speech model is not downloaded yet"* | Download it in **Profile → Transcription**. |
| Model download stuck | The app was sent to the background or the network dropped. Cancel and try again; the partial `.part` file is thrown away. |
| Recording shows **Retry** | Usually it was recorded before a model was installed. Install the model and tap Retry. |
| Live transcript stays empty | Check that *Live Transcript* is on and a model is downloaded. The first preview appears after about 1.5–3 s while the model loads. |
| App won't install (`not enough space`) | The phone's storage is full. Free 1–2 GB; models need space too. |
| Wrong language in the text | Pick the language explicitly before recording instead of *Auto*. |
| Text is in the wrong script (e.g. Persian in Latin letters) | Make sure `fa` is selected so the Persian prompt is used. |
