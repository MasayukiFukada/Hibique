#!/usr/bin/env bash

# アプリ終了時・割り込み時にターミナルの状態（echo / raw mode / カーソル等）を完全自動復旧
cleanup() {
  stty sane < /dev/tty 2>/dev/null || true
  tput cnorm 2>/dev/null || true
  tput sgr0 2>/dev/null || true
}

trap cleanup EXIT INT TERM

pnpm tauri dev
