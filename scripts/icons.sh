#!/usr/bin/env bash
# Exports the app icon (design/sweeter-icon-art.png in the macOS squircle)
# to every PNG the app, the Safari extension, and the page use. Needs only
# Swift (Xcode's command line tools).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
swift "$ROOT/design/sweeter-icon.swift" "$ROOT"
