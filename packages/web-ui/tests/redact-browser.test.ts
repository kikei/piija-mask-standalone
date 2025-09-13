import { describe, it } from 'node:test';
import assert from 'node:assert';
import { redact } from '../src/redact-browser.js';

describe('redact-browser: maskPostalCodes', () => {
  it('masks postal code with 〒 and no hyphen', async () => {
    const result = await redact('住所: 〒2860041 千葉県');
    assert.ok(result.masked.includes('〒＊＊＊＊'));
    assert.ok(!result.masked.includes('2860041'));
    assert.ok(result.positions.some(p => p.type === 'postalCode'));
  });

  it('masks postal code with 〒 and hyphen', async () => {
    const result = await redact('〒286-0041');
    assert.ok(result.masked.includes('〒＊＊＊＊'));
    assert.ok(result.positions.some(p => p.type === 'postalCode'));
  });

  it('masks standalone hyphenated postal code', async () => {
    const result = await redact('郵便番号: 123-4567');
    assert.ok(result.masked.includes('＊＊＊＊'));
    assert.ok(!result.masked.includes('123-4567'));
  });

  it('does not mask 7-digit number without 〒', async () => {
    const result = await redact('コード: 1234567');
    assert.strictEqual(result.masked, 'コード: 1234567');
    assert.ok(!result.positions.some(p => p.type === 'postalCode'));
  });

  it('does not mask phone number as postal code', async () => {
    const result = await redact('電話: 090-1234-5678');
    assert.ok(!result.positions.some(p => p.type === 'postalCode'));
  });

  it('skips postal code detection when maskPostalCodes is false', async () => {
    const result = await redact('〒2860041', { maskPostalCodes: false });
    assert.ok(!result.positions.some(p => p.type === 'postalCode'));
    assert.ok(result.masked.includes('2860041'));
  });
});
