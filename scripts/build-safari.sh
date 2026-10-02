#!/usr/bin/env bash
# Builds Sweeter (the Mac app and its Safari extension) and installs it to
# /Applications. The Xcode project uses extension/ in place: no sync step.
#
# Signing: set SWEETER_TEAM to your Apple developer Team ID (or put
# SWEETER_TEAM=XXXXXXXXXX in scripts/local.env, which git ignores) to sign
# with your Apple Development certificate. Without it the build is signed
# ad hoc, and Safari shows the extension only with Develop > Allow Unsigned
# Extensions turned on. The Sweeter app itself works either way.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/scripts/local.env" ] && . "$ROOT/scripts/local.env"
DD="$ROOT/build/DerivedData"
VERSION=$(node -e "console.log(require('$ROOT/extension/manifest.json').version)")
PROJ="$ROOT/safari/Sweeter/Sweeter.xcodeproj"
sed -i '' "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VERSION;/" "$PROJ/project.pbxproj"

node "$ROOT/tests/run.js"

if [ -n "${SWEETER_TEAM:-}" ]; then
  SIGN=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Development" DEVELOPMENT_TEAM="$SWEETER_TEAM" PROVISIONING_PROFILE_SPECIFIER="")
else
  SIGN=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="-" DEVELOPMENT_TEAM="" PROVISIONING_PROFILE_SPECIFIER="")
fi
xcodebuild -project "$PROJ" -scheme Sweeter -configuration Release \
  -destination 'platform=macOS' -derivedDataPath "$DD" "${SIGN[@]}" \
  clean build -quiet

APP="$DD/Build/Products/Release/Sweeter.app"
DEST="/Applications/Sweeter.app"
osascript -e 'with timeout of 5 seconds' -e 'tell application id "fun.starl3xx.Sweeter" to quit' -e 'end timeout' >/dev/null 2>&1 || true
rm -rf "$DEST"
ditto "$APP" "$DEST"
# A second copy in DerivedData makes Safari list the extension twice.
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -u "$APP" >/dev/null 2>&1 || true
rm -rf "$DD"
"$LSREG" -f "$DEST"
# Safari loads the new build only after the app registers it again: launch hidden, then quit.
open -g -j "$DEST"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  pluginkit -m -i fun.starl3xx.Sweeter.Extension 2>/dev/null | grep -q "($VERSION)" && break
  sleep 1
done
osascript -e 'with timeout of 5 seconds' -e 'tell application id "fun.starl3xx.Sweeter" to quit' -e 'end timeout' >/dev/null 2>&1 || true
echo "Installed $DEST (v$VERSION)"
