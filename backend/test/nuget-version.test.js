import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toNuGetVersion } from '../../scripts/nuget-version.mjs';

describe('toNuGetVersion (NuGet / Squirrel)', () => {
  it('versão estável', () => {
    assert.equal(toNuGetVersion('0.2.1'), '0.2.1');
    assert.equal(toNuGetVersion('1.0.0'), '1.0.0');
  });

  it('remove metadados de build após +', () => {
    assert.equal(toNuGetVersion('1.0.0+abc123'), '1.0.0');
  });

  it('pré-release: pontos no sufixo são colapsados', () => {
    assert.equal(toNuGetVersion('1.0.0-alpha.1'), '1.0.0-alpha1');
    assert.equal(toNuGetVersion('1.2.3-beta.2'), '1.2.3-beta2');
  });

  it('vazio cai em 0.0.0', () => {
    assert.equal(toNuGetVersion(''), '0.0.0');
    assert.equal(toNuGetVersion(null), '0.0.0');
  });
});
