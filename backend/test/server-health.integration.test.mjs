/**
 * Integração: sobe o servidor real numa porta livre e valida GET /health.
 * Não requer curl; útil em Windows e na CI.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const p = typeof addr === 'object' && addr ? addr.port : 0;
      s.close((err) => (err ? reject(err) : resolve(p)));
    });
    s.on('error', reject);
  });
}

test('servidor: GET /health responde com JSON esperado', { timeout: 60_000 }, async () => {
  const port = await freePort();
  const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const proc = spawn(process.execPath, ['src/server.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      ADMIN_API_KEY: '',
    },
    stdio: 'ignore',
  });

  let success = false;
  try {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (!r.ok) {
          await new Promise((res) => setTimeout(res, 250));
          continue;
        }
        const j = await r.json();
        assert.equal(j.ok, true);
        assert.equal(j.service, 'guto-express-backend');
        assert.ok(typeof j.version === 'string' && j.version.length > 0);
        assert.ok(typeof j.node === 'string' && j.node.startsWith('v'));
        success = true;
        break;
      } catch {
        await new Promise((res) => setTimeout(res, 250));
      }
    }
    assert.equal(success, true, 'GET /health não ficou disponível a tempo');
  } finally {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    await new Promise((res) => setTimeout(res, 1000));
    if (proc.exitCode === null) {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }
  }
});
