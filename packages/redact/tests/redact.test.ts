import { describe, it } from 'node:test';
import assert from 'node:assert';
import { redact } from '../src/redact.js';

describe('redact', () => {
  it('redacts multiple types of information', async () => {
    const text = `
      連絡先: test@example.com
      電話: 090-1234-5678
      住所: 東京都新宿区西新宿1-1-1
      郵便番号: 〒100-0001
    `.trim();

    const result = await redact(text);
    assert.ok(result.masked.includes('＊＊＊＊'));
    assert.ok(result.positions.length > 0);
  });

  it('respects skip options', async () => {
    const text = 'Email: test@example.com Phone: 090-1234-5678';
    const result = await redact(text, { skipEmails: true });

    assert.ok(result.masked.includes('test@example.com'));
    assert.ok(result.masked.includes('＊＊＊＊'));
    assert.ok(!result.positions.some(p => p.type === 'email'));
    assert.ok(result.positions.some(p => p.type === 'phone'));
  });

  it('handles empty text', async () => {
    const result = await redact('');
    assert.strictEqual(result.masked, '');
    assert.strictEqual(result.positions.length, 0);
  });

  it('returns positions sorted by start index', async () => {
    const text = 'Phone: 090-1234-5678 Email: test@example.com';
    const result = await redact(text);

    for (let i = 1; i < result.positions.length; i++) {
      assert.ok(result.positions[i]!.start >= result.positions[i - 1]!.start);
    }
  });

  it('handles overlapping detection gracefully', async () => {
    const text = 'Complex: 4111111111111111 and 090-1234-5678';
    const result = await redact(text);

    assert.ok(result.positions.every(p => p.start < p.end));
    assert.ok(result.masked.includes('＊＊＊＊'));
  });

  describe('skip options', () => {
    it('skipNames option', async () => {
      const text = 'タナカ タロウ test@example.com';
      const result = await redact(text, { skipNames: true });
      assert.ok(!result.positions.some(p => p.type === 'name'));
    });

    it('skipPhones option', async () => {
      const text = '090-1234-5678 test@example.com';
      const result = await redact(text, { skipPhones: true });
      assert.ok(!result.positions.some(p => p.type === 'phone'));
    });

    it('skipPostalCodes option', async () => {
      const text = '〒100-0001 test@example.com';
      const result = await redact(text, { skipPostalCodes: true });
      assert.ok(!result.positions.some(p => p.type === 'postal'));
    });

    it('skipCreditCards option', async () => {
      const text = '4111 1111 1111 1111 test@example.com';
      const result = await redact(text, { skipCreditCards: true });
      assert.ok(!result.positions.some(p => p.type === 'creditCard'));
    });

    it('skipMyNumbers option', async () => {
      const text = '123456789016 test@example.com';
      const result = await redact(text, { skipMyNumbers: true });
      assert.ok(!result.positions.some(p => p.type === 'myNumber'));
    });

    it('multiple skip options', async () => {
      const text = 'Email: test@example.com Phone: 090-1234-5678';
      const result = await redact(text, {
        skipEmails: true,
        skipPhones: true,
      });

      assert.ok(!result.positions.some(p => p.type === 'email'));
      assert.ok(!result.positions.some(p => p.type === 'phone'));
    });
  });

  it('handles Japanese text normalization', async () => {
    const text = 'ＥＭＡＩＬ：ｔｅｓｔ＠ｅｘａｍｐｌｅ．ｃｏｍ';
    const result = await redact(text);
    assert.ok(result.positions.some(p => p.type === 'email'));
  });

  it('preserves original text in positions', async () => {
    const text = 'Contact: test@example.com';
    const result = await redact(text);
    const emailPosition = result.positions.find(p => p.type === 'email');
    assert.strictEqual(emailPosition?.original, 'test@example.com');
  });
});
