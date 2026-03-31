/**
 * Integração: sobe o servidor real numa porta livre e valida GET /health.
 * Não requer curl; útil em Windows e na CI.
 */
import { spawn, spawnSync } from 'node:child_process';
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

        const mr = await fetch(`http://127.0.0.1:${port}/menu/items`);
        assert.equal(mr.ok, true);
        const menu = await mr.json();
        assert.equal(menu.ok, true);
        assert.ok(Array.isArray(menu.items));
        assert.equal(menu.source, 'database');

        const mgr = await fetch(`http://127.0.0.1:${port}/menu/manage/items`);
        assert.equal(mgr.ok, true);
        const managed = await mgr.json();
        assert.equal(managed.ok, true);
        assert.ok(Array.isArray(managed.items));

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

test('deploy-smoke: CLI valida /health e /auth/status', { timeout: 60_000 }, async () => {
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

  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        /* */
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    assert.equal(up, true, 'servidor não ficou disponível');

    const smoke = spawnSync(
      process.execPath,
      ['scripts/deploy-smoke.mjs', `http://127.0.0.1:${port}`],
      { cwd: backendRoot, encoding: 'utf8' },
    );
    assert.equal(smoke.status, 0, smoke.stdout + '\n' + smoke.stderr);
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

test('auth: POST /auth/login emite JWT e libera rotas admin', { timeout: 60_000 }, async () => {
  const port = await freePort();
  const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const proc = spawn(process.execPath, ['src/server.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      ADMIN_API_KEY: 'dev-admin-key',
      ADMIN_JWT_SECRET: 'dev-jwt-secret-please-change',
    },
    stdio: 'ignore',
  });

  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        /* */
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    assert.equal(up, true, 'servidor não ficou disponível');

    const bad = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: 'wrong' }),
    });
    assert.equal(bad.status, 401);

    const lr = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: 'dev-admin-key', ttl_seconds: 300 }),
    });
    assert.equal(lr.ok, true);
    const lj = await lr.json();
    assert.equal(lj.ok, true);
    assert.ok(typeof lj.token === 'string' && lj.token.split('.').length === 3);

    const mgr = await fetch(`http://127.0.0.1:${port}/menu/manage/items`, {
      headers: { Authorization: `Bearer ${lj.token}` },
    });
    assert.equal(mgr.ok, true);
    const managed = await mgr.json();
    assert.equal(managed.ok, true);
    assert.ok(Array.isArray(managed.items));
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
