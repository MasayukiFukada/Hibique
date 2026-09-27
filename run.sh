#!/usr/bin/bash

# アプリ終了時・割り込み時にターミナルの状態（echo / raw mode 等）を自動復旧
trap 'stty sane 2>/dev/null' EXIT INT TERM

pnpm tauri dev
