#!/usr/bin/env bash
# starl3xx's flapping bird, built from the icon art by design/loader/bird.py.
#   scripts/bird.sh           the loading screen's poses
#                             (design/loader/sweeter-loader-sprite.png), then
#                             scripts/loader.sh to export them for the app
#   scripts/bird.sh exports   every size and format, in build/bird/exports
#   scripts/bird.sh hero      the bird settling into the icon (design/loader/
#                             hero.py), for the site and the About window, in
#                             build/bird/hero
# The first run makes a Python venv in build/bird/venv. Exports and the hero
# also need ffmpeg and img2webp (brew install ffmpeg webp).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/build/bird/venv"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q numpy==2.5.3 scipy==1.18.1 pillow==12.3.0 opencv-python-headless==5.0.0.93
fi
if [ "${1:-sprite}" = hero ]; then
  exec "$VENV/bin/python" "$ROOT/design/loader/hero.py"
fi
"$VENV/bin/python" "$ROOT/design/loader/bird.py" "${1:-sprite}"
if [ "${1:-sprite}" = sprite ]; then
  "$ROOT/scripts/loader.sh"
fi
