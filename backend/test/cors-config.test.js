import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCorsOriginsList } from '../src/lib/corsConfig.js';

describe('parseCorsOriginsList', () => {
  it('lista vazia', () => {
    assert.deepEqual(parseCorsOriginsList(''), []);
    assert.deepEqual(parseCorsOriginsList(null), []);
  });

  it('uma origem', () => {
    assert.deepEqual(parseCorsOriginsList('https://a.com'), ['https://a.com']);
  });

  it('varias origens e espaços', () => {
    assert.deepEqual(parseCorsOriginsList('https://a.com, https://b.com '), ['https://a.com', 'https://b.com']);
  });
});
