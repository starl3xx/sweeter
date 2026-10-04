#!/usr/bin/env bash
# Builds the downloadable Sweeter.app for a GitHub release:
# build/release/Sweeter-<version>.zip, signed ad hoc (no developer identity
# in it, and debug symbols stripped, so no build paths either). Does not
# install anything.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DD="$ROOT/build/ReleaseData"
OUT="$ROOT/build/release"
VERSION=$(node -e "console.log(require('$ROOT/extension/manifest.json').version)")
PROJ="$ROOT/safari/Sweeter/Sweeter.xcodeproj"
# The version comes from extension/manifest.json, passed to Xcode below
# (building never edits a tracked file). The build number is the count of
# commits (releases build from main), so every build counts up: About shows
# "0.20.0 (27)", and an updater can compare it.
BUILD=$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)

# Usage counts (TelemetryDeck): the App ID lives in scripts/local.env, which
# git ignores, so a build from source sends nothing.
TELEMETRY=$(sed -n 's/^SWEETER_TELEMETRY=//p' "$ROOT/scripts/local.env" 2>/dev/null || true)
TELEMETRY_NS=$(sed -n 's/^SWEETER_TELEMETRY_NAMESPACE=//p' "$ROOT/scripts/local.env" 2>/dev/null || true)
[ -n "$TELEMETRY" ] || echo "warning: no SWEETER_TELEMETRY in scripts/local.env, so this build sends no usage counts" >&2

node "$ROOT/tests/run.js"

xcodebuild -project "$PROJ" -scheme Sweeter -configuration Release MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  -destination 'generic/platform=macOS' -derivedDataPath "$DD" \
  ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO \
  DEPLOYMENT_POSTPROCESSING=YES STRIP_INSTALLED_PRODUCT=YES STRIP_STYLE=non-global COPY_PHASE_STRIP=YES DEBUG_INFORMATION_FORMAT=dwarf-with-dsym \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="-" DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="" \
  SWEETER_TELEMETRY_APP_ID="$TELEMETRY" SWEETER_TELEMETRY_NAMESPACE="$TELEMETRY_NS" SWEETER_TELEMETRY_TEST_MODE=NO \
  clean build -quiet

APP="$DD/Build/Products/Release/Sweeter.app"
# Never registered with Launch Services from here: a second copy would make
# Safari list the extension twice on this Mac.
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -u "$APP" >/dev/null 2>&1 || true
mkdir -p "$OUT"
ZIP="$OUT/Sweeter-$VERSION.zip"
rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
rm -rf "$DD"
echo "$ZIP"
shasum -a 256 "$ZIP"
