#!/usr/bin/env bash

# アプリ終了時・割り込み時に子プロセスの完全終了＆ターミナル状態を自動復旧
cleanup() {
  # 自プロセスグループ配下の子プロセス（Vite等）をすべて道連れ終了
  trap - EXIT INT TERM
  kill -- -$$ 2>/dev/null || true

  # 万が一ポート 5173 を握ったままの残留 Vite プロセスがいれば確実に強制終了
  fuser -k 5173/tcp 2>/dev/null || true

  # ターミナルの状態（echo / raw mode / カーソル等）を完全自動復旧
  stty sane < /dev/tty 2>/dev/null || true
  tput cnorm 2>/dev/null || true
  tput sgr0 2>/dev/null || true
}

trap cleanup EXIT INT TERM

pnpm tauri dev
