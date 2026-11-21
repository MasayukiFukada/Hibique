import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_DEV_PORT,
  buildTauriDevConfig,
  findAvailablePort,
  parsePort,
} from './dev-port.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function resolveTauriCommand() {
  const binName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
  const localBin = path.join(repoRoot, 'node_modules', '.bin', binName);
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return binName;
}

function restoreTerminal() {
  if (!process.stdin.isTTY || process.platform === 'win32') {
    return;
  }
  let ttyFd;
  try {
    ttyFd = fs.openSync('/dev/tty', 'r');
    spawnSync('stty', ['sane'], { stdio: [ttyFd, 'ignore', 'ignore'] });
  } catch {
    // Ignore errors when /dev/tty or stty is unavailable
  } finally {
    if (ttyFd !== undefined) {
      try {
        fs.closeSync(ttyFd);
      } catch {
        // Ignore close error
      }
    }
  }
  for (const cap of ['cnorm', 'sgr0']) {
    try {
      spawnSync('tput', [cap], { stdio: ['ignore', 'inherit', 'ignore'] });
    } catch {
      // Ignore tput errors
    }
  }
}

function terminateChildTree(child, signal) {
  if (!child.pid) {
    return;
  }
  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (err) {
    if (err && err.code !== 'ESRCH') {
      throw err;
    }
  }
}

async function main() {
  const startPort = parsePort(
    process.env.HIBIQUE_DEV_PORT ?? process.env.VITE_PORT,
    DEFAULT_DEV_PORT
  );
  const port = await findAvailablePort(startPort);

  if (port !== startPort) {
    console.log(
      `[Hibique] ポート ${startPort} は使用中のため、ポート ${port} で開発サーバーを起動します。`
    );
  } else {
    console.log(`[Hibique] 開発サーバーをポート ${port} で起動します。`);
  }

  const command = resolveTauriCommand();
  const args = [
    'dev',
    '--config',
    buildTauriDevConfig(port),
    ...process.argv.slice(2),
  ];

  const child = spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      HIBIQUE_DEV_PORT: String(port),
    },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  });

  let isShuttingDown = false;
  let forceKillTimer = null;

  const shutdown = (signal) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    terminateChildTree(child, signal);
    forceKillTimer = setTimeout(() => {
      terminateChildTree(child, 'SIGKILL');
    }, 2000);
    forceKillTimer.unref();
  };

  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => shutdown(sig));
  }

  child.on('error', (err) => {
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
    restoreTerminal();
    console.error('[Hibique] Failed to start Tauri dev process:', err);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
    restoreTerminal();
    if (typeof code === 'number') {
      process.exit(code);
    }
    const signalNumber = signal ? os.constants.signals[signal] : undefined;
    process.exit(typeof signalNumber === 'number' ? 128 + signalNumber : 1);
  });
}

main().catch((err) => {
  restoreTerminal();
  console.error('[Hibique] Failed to launch dev mode:', err);
  process.exit(1);
});
