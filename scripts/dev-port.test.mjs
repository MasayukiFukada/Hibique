import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  DEFAULT_DEV_PORT,
  buildTauriDevConfig,
  findAvailablePort,
  isPortAvailable,
  parsePort,
} from './dev-port.mjs';

describe('parsePort', () => {
  it('parses valid port strings and numbers', () => {
    assert.equal(parsePort('5173'), 5173);
    assert.equal(parsePort(5174), 5174);
    assert.equal(parsePort('1'), 1);
    assert.equal(parsePort(65535), 65535);
  });

  it('falls back when out of range or invalid', () => {
    assert.equal(parsePort(0), DEFAULT_DEV_PORT);
    assert.equal(parsePort(65536), DEFAULT_DEV_PORT);
    assert.equal(parsePort(-1), DEFAULT_DEV_PORT);
    assert.equal(parsePort(1.5), DEFAULT_DEV_PORT);
    assert.equal(parsePort('abc'), DEFAULT_DEV_PORT);
    assert.equal(parsePort(''), DEFAULT_DEV_PORT);
    assert.equal(parsePort(undefined), DEFAULT_DEV_PORT);
    assert.equal(parsePort(null, 6000), 6000);
  });
});

describe('buildTauriDevConfig', () => {
  it('generates JSON config overriding build.devUrl', () => {
    const config = JSON.parse(buildTauriDevConfig(5174));
    assert.deepEqual(config, {
      build: {
        devUrl: 'http://localhost:5174',
      },
    });
  });
});

describe('findAvailablePort', () => {
  it('skips an occupied port and selects a subsequent available port', async () => {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0 }, resolve);
    });

    try {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const occupiedPort = address.port;

      assert.equal(await isPortAvailable(occupiedPort), false);

      const foundPort = await findAvailablePort(occupiedPort, 20);
      assert.notEqual(foundPort, occupiedPort);
      assert.ok(foundPort > occupiedPort);
      assert.equal(await isPortAvailable(foundPort), true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects when no available port is found within maxAttempts', async () => {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0 }, resolve);
    });

    try {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      await assert.rejects(
        () => findAvailablePort(address.port, 1),
        /No available port found/
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
