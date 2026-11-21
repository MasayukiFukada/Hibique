import net from 'node:net';

export const DEFAULT_DEV_PORT = 5173;

/**
 * Parse a port value and return a valid TCP port number or fallback.
 * @param {string | number | undefined | null} value
 * @param {number} [fallback=DEFAULT_DEV_PORT]
 * @returns {number}
 */
export function parsePort(value, fallback = DEFAULT_DEV_PORT) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) {
    return n;
  }
  return fallback;
}

/**
 * Check whether a port can be bound on the specified host.
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
export function isPortAvailableOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once('error', (err) => {
      if (
        host === '::1' &&
        (err.code === 'EADDRNOTAVAIL' || err.code === 'EAFNOSUPPORT')
      ) {
        resolve(true);
        return;
      }
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
        return;
      }
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen({ port, host, exclusive: true });
  });
}

/**
 * Check whether a port is available on both IPv4 and IPv6 loopback addresses.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export async function isPortAvailable(port) {
  const ipv4Free = await isPortAvailableOnHost(port, '127.0.0.1');
  if (!ipv4Free) {
    return false;
  }
  return isPortAvailableOnHost(port, '::1');
}

/**
 * Find the first available TCP port starting from startPort.
 * @param {number} [startPort=DEFAULT_DEV_PORT]
 * @param {number} [maxAttempts=100]
 * @returns {Promise<number>}
 */
export async function findAvailablePort(
  startPort = DEFAULT_DEV_PORT,
  maxAttempts = 100
) {
  const basePort = parsePort(startPort, DEFAULT_DEV_PORT);
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = basePort + offset;
    if (candidate > 65535) {
      break;
    }
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No available port found starting from ${basePort} within ${maxAttempts} attempts`
  );
}

/**
 * Build the JSON config string passed to `tauri dev --config`.
 * @param {number} port
 * @returns {string}
 */
export function buildTauriDevConfig(port) {
  return JSON.stringify({
    build: {
      devUrl: `http://localhost:${port}`,
    },
  });
}
