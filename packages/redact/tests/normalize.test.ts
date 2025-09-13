import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeText } from '../src/normalize.js';

describe('normalizeText', () => {
  it('normalizes Unicode characters', () => {
    const input = 'ＡＢＣ１２３';
    const result = normalizeText(input);
    assert.strictEqual(result, 'ABC123');
  });

  it('normalizes various hyphens', () => {
    const input = 'test‐test-test–test—test−testーtest';
    const result = normalizeText(input);
    assert.strictEqual(result, 'test-test-test-test-test-test-test');
  });

  it('removes zero-width characters', () => {
    const input = 'test\u200Btest\u200Ctest\u200Dtest\uFEFFtest';
    const result = normalizeText(input);
    assert.strictEqual(result, 'testtesttesttesttest');
  });

  it('removes control characters', () => {
    const input = 'test\x00test\x1Ftest\x7Ftest\x9Ftest';
    const result = normalizeText(input);
    assert.strictEqual(result, 'testtesttesttesttest');
  });

  it('normalizes multiple spaces', () => {
    const input = 'test  \t\n  test   test';
    const result = normalizeText(input);
    assert.strictEqual(result, 'test test test');
  });

  it('handles empty string', () => {
    const result = normalizeText('');
    assert.strictEqual(result, '');
  });

  it('handles complex mixed text', () => {
    const input = 'ＨＥＬＬＯ‐\u200Bworld\x00\t  test';
    const result = normalizeText(input);
    assert.strictEqual(result, 'HELLO-world test');
  });
});
