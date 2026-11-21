#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v pnpm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  if [ -d "${HOME:-}/.local/share/mise/shims" ]; then
    export PATH="$HOME/.local/share/mise/shims:$PATH"
  fi
fi

print_help() {
  cat <<'EOF'
Usage: ./run.sh [OPTIONS] [-- EXTRA_ARGS...]

Hibique launcher script (defaults to release binary execution).

Options:
  --release         Launch the release binary (default; builds if missing)
  -d, --dev         Launch in development mode (auto-selects a free port)
  -b, --rebuild     Rebuild the release binary and launch it
      --build       Alias for --rebuild
      --build-only  Build the release binary without launching it
  -h, --help        Show this help message and exit

Environment:
  HIBIQUE_MODE      Default mode when no mode flag is passed ("release" or "dev")
  HIBIQUE_DEV_PORT  Starting port to probe in dev mode (default: 5173)
EOF
}

MODE="${HIBIQUE_MODE:-release}"
FORCE_REBUILD=0
BUILD_ONLY=0
EXTRA_ARGS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    -d|--dev)
      MODE="dev"
      shift
      ;;
    --release)
      MODE="release"
      shift
      ;;
    -b|--rebuild|--build)
      MODE="release"
      FORCE_REBUILD=1
      shift
      ;;
    --build-only)
      MODE="release"
      BUILD_ONLY=1
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    --)
      shift
      while [ "$#" -gt 0 ]; do
        EXTRA_ARGS+=("$1")
        shift
      done
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      print_help >&2
      exit 1
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

if [ "$MODE" != "release" ] && [ "$MODE" != "dev" ]; then
  echo "Invalid HIBIQUE_MODE: '$MODE' (expected 'release' or 'dev')" >&2
  exit 1
fi

RELEASE_BIN="$SCRIPT_DIR/src-tauri/target/release/app"

build_release() {
  echo "[Hibique] Building release binary..."
  pnpm tauri build --no-bundle
}

if [ "$MODE" = "release" ]; then
  if [ "$BUILD_ONLY" -eq 1 ]; then
    build_release
    echo "[Hibique] Release binary ready: $RELEASE_BIN"
    exit 0
  fi

  if [ "$FORCE_REBUILD" -eq 1 ] || [ ! -x "$RELEASE_BIN" ]; then
    build_release
  else
    NEWER_FILE="$(find src src-tauri/src src-tauri/capabilities index.html package.json vite.config.ts src-tauri/Cargo.toml src-tauri/tauri.conf.json -type f -newer "$RELEASE_BIN" 2>/dev/null | head -n 1 || true)"
    if [ -n "$NEWER_FILE" ]; then
      echo "[Hibique] ソースの変更を検出しました。変更を反映するには ./run.sh --rebuild を実行してください。" >&2
    fi
  fi

  if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
    exec "$RELEASE_BIN" "${EXTRA_ARGS[@]}"
  else
    exec "$RELEASE_BIN"
  fi
fi

if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  exec node "$SCRIPT_DIR/scripts/tauri-dev.mjs" "${EXTRA_ARGS[@]}"
else
  exec node "$SCRIPT_DIR/scripts/tauri-dev.mjs"
fi
