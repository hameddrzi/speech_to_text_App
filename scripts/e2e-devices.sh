#!/usr/bin/env bash
# Runs the Maestro E2E suite (.maestro/) on every connected Android phone and booted iOS
# simulator, one device after another, and prints a per-device summary.
#
# Works with the stock bash 3.2 on macOS (no associative arrays, no mapfile).
# See docs/testing.md for setup.
set -euo pipefail

APP_ID="com.voicetranscript.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/e2e-devices.sh [options] [-- <extra maestro test args>]

Runs `maestro --device <id> test <flows>` on each connected device in turn and writes
  reports/<device-model>.xml        JUnit results
  reports/<device-model>/           screenshots + Maestro logs for that device
then prints a summary table (device / OS / pass / fail).

Options:
  -a, --apk PATH          adb install -r this APK on every Android device before testing
  -d, --device ID         only test this device (adb serial or simulator UDID); repeatable
  -f, --flows PATH        flow file or folder (default: .maestro)
  -q, --quick             skip long flows: --exclude-tags slow,network,manual,stress
  -e, --exclude-tags TAGS comma-separated tags to skip (overrides --quick)
  -i, --include-tags TAGS comma-separated tags to run exclusively
  -o, --out DIR           report folder (default: reports)
      --android-only      ignore iOS simulators
      --ios-only          ignore Android devices
  -l, --list              list detected devices and exit
  -h, --help              show this help

Examples:
  scripts/e2e-devices.sh --list
  scripts/e2e-devices.sh --quick
  scripts/e2e-devices.sh --apk android/app/build/outputs/apk/release/app-release.apk
  scripts/e2e-devices.sh -d R5CR20ABCDE -f .maestro/record-basic.yaml
  scripts/e2e-devices.sh -- -e EXPECTED_WORD=fox
EOF
}

die() {
  echo "error: $*" >&2
  exit 2
}

APK=""
FLOWS=".maestro"
OUT="reports"
EXCLUDE_TAGS=""
INCLUDE_TAGS=""
ONLY_DEVICES=()
EXTRA_ARGS=()
WANT_ANDROID=1
WANT_IOS=1
LIST_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    -a | --apk) [ $# -ge 2 ] || die "$1 needs a path"; APK="$2"; shift 2 ;;
    -d | --device) [ $# -ge 2 ] || die "$1 needs an id"; ONLY_DEVICES+=("$2"); shift 2 ;;
    -f | --flows) [ $# -ge 2 ] || die "$1 needs a path"; FLOWS="$2"; shift 2 ;;
    -q | --quick) [ -n "$EXCLUDE_TAGS" ] || EXCLUDE_TAGS="slow,network,manual,stress"; shift ;;
    -e | --exclude-tags) [ $# -ge 2 ] || die "$1 needs tags"; EXCLUDE_TAGS="$2"; shift 2 ;;
    -i | --include-tags) [ $# -ge 2 ] || die "$1 needs tags"; INCLUDE_TAGS="$2"; shift 2 ;;
    -o | --out) [ $# -ge 2 ] || die "$1 needs a folder"; OUT="$2"; shift 2 ;;
    --android-only) WANT_IOS=0; shift ;;
    --ios-only) WANT_ANDROID=0; shift ;;
    -l | --list) LIST_ONLY=1; shift ;;
    -h | --help) usage; exit 0 ;;
    --) shift; EXTRA_ARGS=("$@"); break ;;
    *) usage >&2; die "unknown option: $1" ;;
  esac
done

cd "$REPO_ROOT"
[ -e "$FLOWS" ] || die "flows not found: $FLOWS"
FLOWS_ABS="$(cd "$(dirname "$FLOWS")" && pwd)/$(basename "$FLOWS")"
mkdir -p "$OUT"
OUT_ABS="$(cd "$OUT" && pwd)"

if [ -n "$APK" ]; then
  [ -f "$APK" ] || die "APK not found: $APK"
  APK="$(cd "$(dirname "$APK")" && pwd)/$(basename "$APK")"
fi

# ── Device discovery ──
# Parallel arrays, one entry per device: platform, id, model, OS version.
DEV_PLATFORM=()
DEV_ID=()
DEV_MODEL=()
DEV_OS=()

wanted() {
  [ ${#ONLY_DEVICES[@]} -eq 0 ] && return 0
  local d
  for d in "${ONLY_DEVICES[@]}"; do [ "$d" = "$1" ] && return 0; done
  return 1
}

trim() { tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

if [ "$WANT_ANDROID" -eq 1 ] && command -v adb >/dev/null 2>&1; then
  while read -r serial state _; do
    [ "$state" = "device" ] || continue
    wanted "$serial" || continue
    maker="$(adb -s "$serial" shell getprop ro.product.manufacturer </dev/null | trim)"
    model="$(adb -s "$serial" shell getprop ro.product.model </dev/null | trim)"
    release="$(adb -s "$serial" shell getprop ro.build.version.release </dev/null | trim)"
    DEV_PLATFORM+=("android")
    DEV_ID+=("$serial")
    DEV_MODEL+=("${maker:+$maker }${model:-unknown}")
    DEV_OS+=("Android ${release:-?}")
  done < <(adb devices | tail -n +2)
fi

if [ "$WANT_IOS" -eq 1 ] && [ "$(uname -s)" = "Darwin" ] && command -v xcrun >/dev/null 2>&1; then
  # Lines look like:  "-- iOS 17.5 --"  then  "    iPhone 15 (UDID) (Booted)"
  while IFS='|' read -r udid name runtime; do
    [ -n "$udid" ] || continue
    wanted "$udid" || continue
    DEV_PLATFORM+=("ios")
    DEV_ID+=("$udid")
    DEV_MODEL+=("$name")
    DEV_OS+=("$runtime")
  done < <(xcrun simctl list devices booted | awk '
    /^-- / { runtime = $0; gsub(/^-- | --$/, "", runtime); next }
    /\(Booted\)/ {
      if (match($0, /\([0-9A-Fa-f-]{36}\)/)) {
        udid = substr($0, RSTART + 1, RLENGTH - 2)
        name = substr($0, 1, RSTART - 1)
        gsub(/^[ \t]+|[ \t]+$/, "", name)
        print udid "|" name "|" runtime
      }
    }')
fi

COUNT=${#DEV_ID[@]}
if [ "$COUNT" -eq 0 ]; then
  echo "No devices found."
  echo "  Android: plug in a phone with USB debugging on and accept the RSA prompt (check: adb devices)."
  echo "  iOS:     boot a simulator (xcrun simctl boot <udid>) on macOS."
  exit 1
fi

echo "Devices:"
i=0
while [ "$i" -lt "$COUNT" ]; do
  printf '  %-8s %-24s %-32s %s\n' "${DEV_PLATFORM[$i]}" "${DEV_ID[$i]}" "${DEV_MODEL[$i]}" "${DEV_OS[$i]}"
  i=$((i + 1))
done
[ "$LIST_ONLY" -eq 0 ] || exit 0

command -v maestro >/dev/null 2>&1 || die "maestro not found. Install it: curl -fsSL \"https://get.maestro.mobile.dev\" | bash"

# Newer Maestro versions can put logs and screenshots in a folder of our choosing.
SUPPORTS_OUTPUT_DIR=0
if maestro test --help 2>&1 | grep -q -- '--test-output-dir'; then SUPPORTS_OUTPUT_DIR=1; fi

TAG_ARGS=()
[ -z "$EXCLUDE_TAGS" ] || TAG_ARGS+=(--exclude-tags "$EXCLUDE_TAGS")
[ -z "$INCLUDE_TAGS" ] || TAG_ARGS+=(--include-tags "$INCLUDE_TAGS")

# "Samsung SM-G780G" → "Samsung_SM-G780G"; a second phone of the same model gets its serial appended.
# Sets SLUG (not echoed: a $(...) subshell would lose the USED_SLUGS bookkeeping).
USED_SLUGS=" "
SLUG=""
make_slug() {
  SLUG="$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_' | sed -e 's/__*/_/g' -e 's/^_//' -e 's/_$//')"
  [ -n "$SLUG" ] || SLUG="device"
  case "$USED_SLUGS" in *" $SLUG "*) SLUG="${SLUG}_$(printf '%s' "$2" | tr -c 'A-Za-z0-9' '_')" ;; esac
  USED_SLUGS="$USED_SLUGS$SLUG "
}

# Reads tests/failures/errors from the first <testsuite> element of a JUnit file.
junit_attr() {
  grep -o "<testsuite [^>]*" "$1" 2>/dev/null | head -n 1 | grep -o " $2=\"[0-9]*\"" | grep -o '[0-9][0-9]*' || echo 0
}

RES_PASS=()
RES_FAIL=()
RES_NOTE=()
OVERALL=0
STARTED=$(date +%s)

i=0
while [ "$i" -lt "$COUNT" ]; do
  platform="${DEV_PLATFORM[$i]}"
  id="${DEV_ID[$i]}"
  make_slug "${DEV_MODEL[$i]}" "$id"
  slug="$SLUG"
  dev_dir="$OUT_ABS/$slug"
  xml="$OUT_ABS/$slug.xml"
  rm -rf "$dev_dir" "$xml"
  mkdir -p "$dev_dir"
  note=""

  echo
  echo "════ ${DEV_MODEL[$i]} · ${DEV_OS[$i]} · $id ════"

  if [ -n "$APK" ]; then
    if [ "$platform" = "android" ]; then
      echo "Installing $(basename "$APK")…"
      if ! adb -s "$id" install -r -d "$APK" </dev/null; then
        echo "  install failed, skipping this device" >&2
        RES_PASS+=(0); RES_FAIL+=(0); RES_NOTE+=("install failed"); OVERALL=1
        i=$((i + 1)); continue
      fi
    else
      note="APK skipped (iOS)"
    fi
  fi

  if [ "$platform" = "android" ]; then
    if ! adb -s "$id" shell pm path "$APP_ID" </dev/null >/dev/null 2>&1; then
      echo "  $APP_ID is not installed (pass --apk), skipping" >&2
      RES_PASS+=(0); RES_FAIL+=(0); RES_NOTE+=("app not installed"); OVERALL=1
      i=$((i + 1)); continue
    fi
    # Keep the screen on while plugged in, so a long run doesn't hit the lock screen.
    adb -s "$id" shell svc power stayon usb </dev/null >/dev/null 2>&1 || true
  fi

  OUTPUT_ARGS=()
  [ "$SUPPORTS_OUTPUT_DIR" -eq 0 ] || OUTPUT_ARGS+=(--test-output-dir "$dev_dir")

  # Run from the device folder: takeScreenshot writes relative to the working directory.
  set +e
  (
    cd "$dev_dir" &&
      maestro --device "$id" test "$FLOWS_ABS" \
        --format junit --output "$xml" \
        ${TAG_ARGS[@]+"${TAG_ARGS[@]}"} \
        ${OUTPUT_ARGS[@]+"${OUTPUT_ARGS[@]}"} \
        ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
  ) 2>&1 | tee "$dev_dir/maestro.log"
  status=${PIPESTATUS[0]}
  set -e

  if [ -f "$xml" ]; then
    tests="$(junit_attr "$xml" tests)"
    failures="$(junit_attr "$xml" failures)"
    errors="$(junit_attr "$xml" errors)"
    fail=$((failures + errors))
    pass=$((tests - fail))
  else
    pass=0
    fail=0
    note="${note:+$note; }no JUnit report (see $slug/maestro.log)"
  fi
  [ "$status" -eq 0 ] || { OVERALL=1; [ "$fail" -gt 0 ] || note="${note:+$note; }maestro exit $status"; }

  shots=$(find "$dev_dir" -name '*.png' | wc -l | tr -d ' ')
  note="${note:+$note; }$shots screenshots"
  RES_PASS+=("$pass")
  RES_FAIL+=("$fail")
  RES_NOTE+=("$note")
  i=$((i + 1))
done

ELAPSED=$(($(date +%s) - STARTED))

echo
echo "Summary ($((ELAPSED / 60)) min $((ELAPSED % 60)) s) — reports in $OUT/"
printf '%-28s %-14s %-20s %5s %5s  %s\n' "DEVICE MODEL" "OS" "SERIAL/UDID" "PASS" "FAIL" "NOTES"
printf '%-28s %-14s %-20s %5s %5s  %s\n' "----------------------------" "--------------" "--------------------" "-----" "-----" "-----"
i=0
while [ "$i" -lt "$COUNT" ]; do
  printf '%-28s %-14s %-20s %5s %5s  %s\n' "${DEV_MODEL[$i]}" "${DEV_OS[$i]}" "${DEV_ID[$i]}" \
    "${RES_PASS[$i]}" "${RES_FAIL[$i]}" "${RES_NOTE[$i]}"
  i=$((i + 1))
done

exit "$OVERALL"
