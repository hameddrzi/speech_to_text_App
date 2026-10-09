# Voice — on-device voice notes with transcription

A voice recorder for Android and iOS that turns speech into text **entirely on the phone**.
No account, no API key, no server: audio is recorded, stored and transcribed locally with
[Whisper](https://github.com/openai/whisper) (via [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
and [`whisper.rn`](https://github.com/mybigday/whisper.rn)).

The interface is modeled on Apple's Voice Memos: a white, airy layout with frosted-glass cards,
pills and tab bar.

| | |
|---|---|
| **Platforms** | Android (tested on a Galaxy S20 FE), iOS (builds from the same code, not yet tested on device), Web (UI preview only) |
| **Language** | English |
| **Stack** | Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript · Reanimated 4 |
| **Privacy** | Audio never leaves the device. The only network request is the one-time model download. |

---

## Features

**Record**
- One-tap recording with pause, resume, discard and save.
- Live scrolling waveform and a precise timer (`00:00,00`).
- **Live transcript** card: text appears while you speak (a rolling Whisper preview, updated about every 1.5 s).
- Model status pill in the header: shows the active speech model, download progress, or a shortcut to get one.

**Archive**
- All recordings, grouped by date (Today, Yesterday, Previous 7 Days…), with search across titles *and* transcript text.
- Filters: All · Favorites · Transcribed.
- Status chips per recording: *Transcribing*, *Waiting* (no speech model yet), *Transcript*, *Retry*.
- Detail screen with a scrubbable waveform, playback speed, ±15 s skip, rename, favorite and delete.
- Time-coded transcript that highlights and follows the audio as it plays; tap a line to jump there; copy all text.
- **Export** (download button next to Share): save the transcript as a designed **PDF** (title, date, duration and word count chips,
  the waveform, and every line with its timestamp) or as **Markdown** (`.md`) for notes apps. On Android the file is saved
  into a folder you pick once (remembered, changeable); *Share file…* sends it anywhere else. On iOS it opens the share
  sheet (*Save to Files*). On web, Markdown downloads and the PDF opens the print dialog (*Save as PDF*).

**Profile**
- Your name (optional, stays on the phone) and weekly activity stats.
- Transcription settings: speech model, live transcript on/off, haptics on/off.
- Model manager: download, switch and delete Whisper models, with progress.
- Storage overview and an auto-delete policy (never / 30 days / 1 year; favorites are always kept).

---

## Quick start

> **Expo Go will not work.** The app uses native modules (`whisper.rn`, `@fugood/react-native-audio-pcm-stream`),
> so it needs a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

### Requirements

- Node.js 20+ and npm
- **Android:** Android SDK + NDK (Android Studio is the easiest way), JDK 17+, a device with USB debugging or an emulator
- **iOS:** a Mac with Xcode
- About 2 GB of free space on the phone for the app plus a speech model

### Run on a device

```bash
git clone https://github.com/hameddrzi/speech_to_text_App.git
cd speech_to_text_App
npm install

npx expo run:android      # or: npx expo run:ios
```

The first build compiles whisper.cpp and takes a few minutes. Afterwards, `npx expo start --dev-client`
is enough for JavaScript changes.

### First use

1. Open **Profile → Transcription → Download Model** (Small, ~190 MB, is the default).
2. Go to **Record** and tap the red button.
3. Stop. The recording appears in **Archive** and is transcribed in the background.

### Build a standalone APK (no computer needed to run it)

```bash
cd android
./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
adb install -r app/build/outputs/apk/release/app-release.apk
```

The release APK is about 54 MB and contains the JavaScript bundle, so it runs without Metro.
It is currently signed with the debug keystore, which is fine for personal installs but
[not for the Play Store](https://reactnative.dev/docs/signed-apk-android).

`--no-daemon` makes Gradle exit after the build instead of staying in memory.

---

## Speech models

All models are multilingual Whisper checkpoints in ggml format, downloaded from
[huggingface.co/ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) into the app's
private storage on first use.

| Model | Download | Speed | Accuracy | Recommended for |
|---|---|---|---|---|
| Tiny | 78 MB | fastest | basic | quick tests |
| Base | 148 MB | fast | fair | clear English speech |
| **Small** (default) | 190 MB | balanced | moderate | most phones |
| Turbo (large-v3-turbo, q5) | 574 MB | slower | **best** | recent phones |

Larger models are noticeably more accurate. See [docs/speech-to-text.md](docs/speech-to-text.md#accuracy)
for details.

---

## Documentation

| Document | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How the app is put together: screens, state, storage, data flow |
| [docs/speech-to-text.md](docs/speech-to-text.md) | The on-device transcription pipeline, models, tuning and troubleshooting |
| [docs/design-system.md](docs/design-system.md) | Colors, type, spacing and the `<Glass>` material, plus rules for new UI |
| [docs/testing.md](docs/testing.md) | End-to-end tests with Maestro on real phones, the multi-device runner, manual checklist and device matrix |

---

## Project structure

```
src/
├── app/                      # Screens (Expo Router, file-based)
│   ├── _layout.tsx           # Root: providers, background transcription worker, stack
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Record · Archive · Profile with the glass tab bar
│   │   ├── index.tsx         # Record screen
│   │   ├── archive.tsx       # Archive list
│   │   └── profile.tsx       # Profile & settings
│   └── recording/[id].tsx    # Recording detail (playback + transcript)
├── components/
│   ├── glass.tsx             # The shared frosted-glass surface
│   ├── glass-tab-bar.tsx     # Floating glass tab bar
│   ├── ambient-background.tsx
│   ├── record/               # Record button, waveform, live transcript card…
│   ├── archive/              # Rows, search, playback hook, transcript card, scrubber…
│   └── profile/              # Settings list, option and name sheets, stats…
├── stt/                      # On-device speech-to-text (Whisper)
├── export/                   # Transcript export: Markdown, PDF template (expo-print), save/share
├── hooks/                    # Recording session (native + web variants)
├── store/                    # Recordings and settings (React context + JSON persistence)
├── data/                     # Recording types and web preview sample data
├── constants/theme.ts        # Design tokens
├── constants/test-ids.ts     # testIDs used by the Maestro E2E flows
└── utils/                    # Formatting, JSON storage
```

---

## Commands

```bash
npx expo start --dev-client   # start Metro for a development build
npx expo run:android          # build + install the development build
npx tsc --noEmit              # type check
npx expo lint                 # lint
npx expo install <package>    # add a dependency at the SDK-compatible version

maestro test .maestro --exclude-tags slow,network,manual,stress   # quick E2E pass on a connected phone
scripts/e2e-devices.sh --quick                                    # same, on every connected phone
node scripts/check-e2e-ids.js                                     # flows only use ids defined in test-ids.ts
```

See [docs/testing.md](docs/testing.md) for the end-to-end test setup.

The `android/` and `ios/` folders are generated (see `.gitignore`); `npx expo run:*` or
`npx expo prebuild` recreates them.

---

## Known limitations

- **iOS** has not been built or tested on a device yet.
- **English only.** Transcription always runs with Whisper's language set to English.
- **Web** is a UI preview: recording is simulated and transcription is unavailable.
- While a long recording is being transcribed in the background, the live preview of a new recording
  stays empty until that job finishes (the engine runs one job at a time).
- Speaker labels (who said what) are not supported.

---

## License

No license has been chosen for this project yet. The [LICENSE](LICENSE) file in the repository is
the MIT license that came with the Expo starter template. Whisper models are released by OpenAI
under the MIT license.
