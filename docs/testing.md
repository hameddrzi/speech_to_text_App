# Testing on real devices

The app is tested end to end with [Maestro](https://maestro.dev): YAML flows in `.maestro/` drive
the real app on a phone over USB (Android) or on an iOS simulator, tap through every screen and
take screenshots, so results from different phone models can be compared side by side.

This document covers setup, running the suite on one or all phones, what each flow checks, and
the manual checks that automation can't do.

## Contents

- [Setup](#setup)
- [Build the app under test](#build-the-app-under-test)
- [Running the suite](#running-the-suite)
- [Flows and tags](#flows-and-tags)
- [Reports and screenshots](#reports-and-screenshots)
- [Writing and maintaining flows](#writing-and-maintaining-flows)
- [Manual checklist](#manual-checklist)
- [Device matrix](#device-matrix)

## Setup

| What | How |
|---|---|
| **Java 17+** | Maestro runs on the JVM. `java -version` must print 17 or newer (Android Studio's bundled JDK works: point `JAVA_HOME` at it). |
| **Maestro CLI** | `curl -fsSL "https://get.maestro.mobile.dev" \| bash`, then open a new terminal and check `maestro --version`. |
| **adb** (Android) | Comes with the Android SDK platform-tools. `adb devices` must list each phone as `device`. |
| **Xcode** (iOS, macOS only) | Simulators only; boot one with `xcrun simctl boot "iPhone 16"` or from Xcode. |

**Each Android phone, once:**

1. Settings → About phone → tap *Build number* 7 times to unlock Developer options.
2. Developer options → turn on **USB debugging**. On Xiaomi/Redmi/POCO also turn on
   **USB debugging (Security settings)**, otherwise taps are rejected. On some Oppo/Realme/Vivo
   builds turn off *Permission monitoring* / *Disable permission monitoring* as needed.
3. Plug in, accept the *Allow USB debugging?* prompt (tick *Always allow*).
4. Recommended: Developer options → set *Window/Transition/Animator animation scale* to **0.5x**
   or **off** for faster, steadier runs. Keep the screen lock off during long runs (the runner
   script also enables *stay awake while charging*).

## Build the app under test

Run the suite against a **release (or EAS preview) build**. It contains the JavaScript bundle, so
it needs no Metro server, has no dev menu overlays and behaves like what users install.

```bash
npx expo prebuild --platform android          # only if android/ doesn't exist yet
cd android
./gradlew app:assembleRelease --no-daemon
cd ..
# → android/app/build/outputs/apk/release/app-release.apk
#   (all four ABIs: installs on 32- and 64-bit phones and x86_64 emulators)
```

Or in the cloud: `npx eas-cli@latest build --platform android --profile preview` (the `preview`
profile in `eas.json` builds an all-ABI APK) and download the APK.

Keep using the same signing key for the test phones as for your own installs: an APK signed with a
different key can't update the installed app, and uninstalling it deletes all recordings. See
[Build for distribution](../README.md#build-for-distribution) for setting up the key.

For iOS, build for the simulator (`npx expo run:ios --configuration Release`) and run the suite on
the booted simulator.

**Development builds** start in the dev-client launcher instead of the app. If you need to test
one, start Metro (`npx expo start --dev-client`) and use the optional subflow
`.maestro/subflows/_dev-client-open.yaml`, which deep-links the launcher to `METRO_URL`
(`voicetranscript://expo-development-client/?url=…`). Its header explains how to wire it in.

## Running the suite

All commands run from the repository root.

### Quick run on one phone (~10 min)

```bash
adb devices                                         # note the serial
adb install -r android/app/build/outputs/apk/release/app-release.apk
maestro --device <serial> test .maestro --exclude-tags slow,network,manual,stress
```

### One flow

```bash
maestro test .maestro/record-basic.yaml             # with a single phone connected
maestro --device <serial> test .maestro/detail.yaml
maestro studio                                      # interactive inspector: see ids, try commands
```

### Whole suite on one phone (~25-35 min)

```bash
maestro --device <serial> test .maestro             # everything except `manual`
```

### Every connected phone (sequentially)

```bash
scripts/e2e-devices.sh --list                                   # what's connected
scripts/e2e-devices.sh --quick \
  --apk android/app/build/outputs/apk/release/app-release.apk  # install + quick suite on all
scripts/e2e-devices.sh                                          # full suite on all
scripts/e2e-devices.sh -d <serial> -f .maestro/export.yaml      # one flow, one phone
scripts/e2e-devices.sh --help                                   # all options
```

The script finds Android phones (`adb devices`) and, on macOS, booted iOS simulators, installs the
APK on each Android phone if `--apk` is given, runs Maestro on one device after another and prints
a summary:

```
DEVICE MODEL                 OS             SERIAL/UDID           PASS  FAIL  NOTES
samsung SM-G780F             Android 13     R5CR20ABCDE              9     1  41 screenshots
Google Pixel 7               Android 14     2B141FDH2001JK          10     0  43 screenshots
```

It exits non-zero if any device had a failure. Anything after `--` goes to `maestro test`, for
example `scripts/e2e-devices.sh -- -e EXPECTED_WORD=fox`.

## Flows and tags

| Flow | Tags | Time* | What it checks |
|---|---|---|---|
| `smoke.yaml` | smoke, quick | ~1 min | Clean launch, the real microphone dialog (Android 11-14 and iOS button variants), one take, all three tabs render |
| `record-basic.yaml` | record, quick | ~1 min | Record 5 s → pause 2 s → resume 3 s → stop → toast → *View* → open; the saved duration is **≥ 0:07** (guards the bug where audio after resume was lost; the duration comes from the WAV actually written) |
| `record-discard.yaml` | record, quick | ~45 s | Discard → Cancel keeps recording; Discard → Delete resets the timer and saves nothing |
| `record-permission-denied.yaml` | manual, record | ~30 s | Microphone denied → "Microphone access needed" card, dismiss. Excluded by default; see its header for how to deny first |
| `archive.yaml` | archive | ~1.5 min | Search (match, no match, clear), All/Favorites/Transcribed filters, swipe → favorite → Favorites shows it, swipe → delete → confirm |
| `detail.yaml` | detail | ~1.5 min | Play/pause, ±15 s skip, speed 1× → 1.5× → 2× → 1×, favorite, rename, copy text (when transcribed), delete |
| `export.yaml` | export | ~2 min | Export sheet; Markdown and PDF saved (Android folder picker on first save) with the *Saved* banner; *Share file* opens the system sheet; Done |
| `profile.yaml` | profile, quick | ~1.5 min | Name sheet (save, cancel, backdrop), switches, speech model sheet, delete-recordings sheet, scroll to the bottom |
| `model-download.yaml` | network, slow | 2-6 min | Pick Tiny → GET → cancel → GET → *Model Ready* (78 MB from Hugging Face) |
| `transcribe-e2e.yaml` | slow | 1-4 min | Record ~10 s **of speech** → background Whisper (Tiny) → archive chip *Transcript* → transcript lines on the detail screen |
| `stress.yaml` | stress, slow | 6-10 min | 10 quick takes, 30 tab switches, every sheet opened/closed 5×, then smoke checks |

\* On a mid-range phone with animations at 0.5x. `config.yaml` fixes the order and keeps going
after a failure. Subflows in `.maestro/subflows/` are building blocks and never run on their own.

**Tag recipes**

```bash
--exclude-tags slow,network,manual,stress    # quick pass, ~10 min, no network needed
--include-tags quick                          # the 4 fastest flows, ~5 min
--include-tags network,slow                   # model download + transcription only
--include-tags stress                         # just the stress flow
```

### Flows that need the tester

- **`transcribe-e2e.yaml` needs sound.** While it records (about 10 s after the record tap),
  say a known sentence near the phone, e.g. *"The quick brown fox jumps over the lazy dog.
  Testing one two three."*, or play a speech clip from a laptop speaker. Silence becomes *No speech
  detected* and the flow fails on purpose. Add `-e EXPECTED_WORD=fox` to also check a word.
  It doesn't clear app data, so it reuses the Tiny model that `model-download.yaml` leaves behind.
- **`export.yaml` on Android** hits the system folder picker the first time it saves. The flow
  steps into *Documents* and taps *Use this folder* → *Allow*, which matches AOSP, Pixel and
  Samsung. If your phone's Files app looks different, pick a folder by hand when the picker shows;
  the flow waits up to 60 s.
- **`record-permission-denied.yaml`** is `manual`: Maestro launches with the microphone denied,
  but some OEM builds still need the denial set by hand (instructions in the file's header).

## Reports and screenshots

| Path | Contents |
|---|---|
| `reports/<device-model>.xml` | JUnit results per device (open in any CI viewer or IDE) |
| `reports/<device-model>/` | Screenshots (`<flow>_<step>_<what>.png`), `maestro.log`, and Maestro's own logs/debug output when the installed version supports `--test-output-dir` |
| `~/.maestro/tests/<timestamp>/` | Maestro's debug output (hierarchy dumps, failure screenshots) when running `maestro` directly |

`reports/` is git-ignored. Screenshot names are identical on every device, so you can compare,
for example, `record-basic_06_detail_duration.png` across all phone folders. When running `maestro`
directly (not through the script), screenshots land in the current folder.

## Writing and maintaining flows

- **Select by id, not by text.** Every interactive element has a `testID` from
  `src/constants/test-ids.ts` (kebab-case). On Android it becomes the view's `resource-id`, on iOS
  its accessibility identifier. Put new ids in that file and use the constant in the component,
  on the touchable itself (the `Pressable`/`TextInput`), never on a decorative child.
- **Check ids after editing flows or components:** `node scripts/check-e2e-ids.js` parses every
  flow and fails on any id that isn't defined in `test-ids.ts`.
- Dynamic ids: `recording-row-<recording id>` (flows use the regex `recording-row-.*`),
  `transcript-segment-<n>`, `model-option-<tiny|base|small|turbo>`,
  `auto-delete-option-<never|30d|1y>`, `<model|auto-delete>-sheet` and `-sheet-done`.
- **iOS caveat:** an element with an accessibility label (all our buttons and the archive rows)
  hides its children from iOS UI automation. So assert on the element's id plus its label (e.g.
  `id: detail-speed` + `text: "Playback speed 1.5x.*"`), not on inner text. Flows that read inner
  text (the archive status chip) do so on Android only.
- **Alerts:** use `subflows/confirm-alert.yaml` / `cancel-alert.yaml`. On Android they tap
  `android:id/button1` / `button2`, which works regardless of OEM and capitalisation.
- **Waiting:** prefer `extendedWaitUntil` on a real condition (the recording timer text, a chip,
  a banner) over fixed sleeps. The one fixed pause (2 s while paused in `record-basic`) waits for a
  sentinel text that never appears, with `optional: true`.
- Don't use `hideKeyboard`: on Android it can send Back, which closes a sheet or leaves a tab.

## Manual checklist

Maestro sees the screen, not the sound, the vibration motor or the OS around the app. Go through
this list once per phone model (≈ 15 min) and note the results in the device matrix.

**Audio**
- [ ] Record 30 s of normal speech at arm's length, play it back: clear, no clipping, no crackle,
      no gaps, correct speed and pitch.
- [ ] Record → pause 5 s → resume → stop: playback has no click or gap at the resume point and
      the pause isn't in the audio.
- [ ] Quiet room vs. noisy room (TV on): waveform reacts, speech still intelligible.
- [ ] Bluetooth headset connected: recording uses the expected mic; playback goes to the headset.
- [ ] Wired/USB-C headset plugged and unplugged mid-playback: playback pauses or reroutes sanely.
- [ ] Playback at 1.5× and 2×: pitch preserved, speech intelligible.
- [ ] Phone volume at 0 and at max during playback; loudspeaker vs. earpiece.

**Transcription**
- [ ] Live transcript shows words within ~2 s while speaking (with a model downloaded).
- [ ] Final transcript quality with Small vs. Tiny on the same 30 s sample; note the time it takes.
- [ ] Transcribing a 5-10 min recording: progress moves, the phone gets warm but the app stays
      responsive; switching tabs doesn't stop it.

**Haptics**
- [ ] Record start/stop, tab switches, toggles and the delete warning vibrate (Haptics on).
- [ ] With Profile → Haptics off: no vibration anywhere.
- [ ] With the system's touch vibration turned off: the app respects it or still vibrates (note which).

**Background and interruptions**
- [ ] Start recording, press Home, wait 30 s, come back: note whether recording continued, paused
      or stopped, and that the saved file matches.
- [ ] Lock the screen while recording for 30 s, unlock: same as above.
- [ ] Incoming phone call (call the phone) while recording: no crash; the take is saved or stopped
      cleanly; the mic is released after the call.
- [ ] Another app takes the mic (start a voice note in WhatsApp, or the system recorder) while
      recording: no crash, a clear state when returning.
- [ ] Alarm/timer goes off during playback: playback ducks or pauses and resumes sanely.
- [ ] Kill the app during background transcription and reopen: the job restarts and finishes.
- [ ] Low storage (< 500 MB free): model download fails with a clear message, recording still works.
- [ ] Battery saver / Doze on: model download and transcription still complete (maybe slower).

**Permissions and system UI**
- [ ] Fresh install: first record tap shows the system dialog; *Only this time* works and asks
      again on next launch.
- [ ] Deny twice (Android marks it as blocked): the card offers *Open Settings*, which opens the
      app's settings page; granting there and returning lets you record.
- [ ] Revoke the microphone in system settings while the app is in the background, then return
      and record: the card appears, no crash.
- [ ] System font size at largest and display size at largest: nothing important is clipped;
      tab bar, record button and sheets still usable.
- [ ] Dark mode on: the app stays light (by design) and stays legible.
- [ ] Gesture navigation vs. 3-button navigation: the floating tab bar and sheets clear the bar.
- [ ] Notch/punch-hole and rounded corners: headers aren't hidden.
- [ ] Export: picked folder on an SD card or in Google Drive (if offered) works; the files open in
      a PDF viewer and a Markdown/notes app.

## Device matrix

Copy this table into an issue or a spreadsheet and fill one row per phone. Use the model and OS
exactly as the runner script prints them.

| Device model | OS | RAM | Build (APK/commit) | Date | Quick suite | Full suite | Flows failing | Manual checklist | Tiny transcribe time (10 s clip) | Notes / OEM quirks |
|---|---|---|---|---|---|---|---|---|---|---|
| samsung SM-G780F (Galaxy S20 FE) | Android 13 | 6 GB | | | ☐ pass / ☐ fail | ☐ pass / ☐ fail | | ☐ done | | |
| | | | | | ☐ pass / ☐ fail | ☐ pass / ☐ fail | | ☐ done | | |
| | | | | | ☐ pass / ☐ fail | ☐ pass / ☐ fail | | ☐ done | | |
| | | | | | ☐ pass / ☐ fail | ☐ pass / ☐ fail | | ☐ done | | |
| iPhone simulator | iOS | — | | | ☐ pass / ☐ fail | ☐ pass / ☐ fail | | n/a | | |
