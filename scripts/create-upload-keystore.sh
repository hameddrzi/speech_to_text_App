#!/usr/bin/env bash
# Create the upload keystore for signing local Android release builds of Voice.
#
#   bash scripts/create-upload-keystore.sh [path/to/voice-upload.keystore]
#
# Default location: ~/.android-keys/voice-upload.keystore (outside the repository).
# The script prints the Gradle properties to add to ~/.gradle/gradle.properties.
# plugins/with-release-signing.js reads them during `./gradlew app:assembleRelease`.
#
# Keep the keystore and its passwords safe and backed up. Every update of the app must be
# signed with the same key; switching keys means uninstalling the app, which deletes all
# recordings on the phone.
set -euo pipefail

KEYSTORE="${1:-$HOME/.android-keys/voice-upload.keystore}"
ALIAS="voice"

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK (17+) or add \$JAVA_HOME/bin to PATH." >&2
  exit 1
fi

if [ -e "$KEYSTORE" ]; then
  echo "Refusing to overwrite existing keystore: $KEYSTORE" >&2
  echo "Delete or move it first if you really want a new key (existing installs can't be updated with a new key)." >&2
  exit 1
fi

mkdir -p "$(dirname "$KEYSTORE")"
KEYSTORE="$(cd "$(dirname "$KEYSTORE")" && pwd)/$(basename "$KEYSTORE")"

case "$KEYSTORE" in
  "$(git rev-parse --show-toplevel 2>/dev/null || echo /nonexistent)"/*)
    echo "Warning: the keystore is inside the repository. *.keystore is gitignored, but keep a copy elsewhere." >&2
    ;;
esac

echo "Creating $KEYSTORE (keytool will ask for a password and your name/organization)..."
keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000
chmod 600 "$KEYSTORE"

cat <<EOF

Done. Add these lines to ~/.gradle/gradle.properties (NOT to the repository):

VOICE_UPLOAD_STORE_FILE=$KEYSTORE
VOICE_UPLOAD_STORE_PASSWORD=<the password you just entered>
VOICE_UPLOAD_KEY_ALIAS=$ALIAS
VOICE_UPLOAD_KEY_PASSWORD=<the same password (PKCS12 keys share the store password)>

Then build:  cd android && ./gradlew app:assembleRelease --no-daemon
Back up $KEYSTORE and the password (e.g. in a password manager). If you lose them you can't
update installed copies of the app without uninstalling, which deletes all recordings.
EOF
