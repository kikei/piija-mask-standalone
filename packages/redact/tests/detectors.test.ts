import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  maskEmail,
  maskPhone,
  maskPostalCode,
  maskCreditCard,
  maskMyNumber,
  MASK_TOKEN,
} from '../src/detectors.js';

describe('maskEmail', () => {
  it('masks valid email addresses', () => {
    const text = 'Contact me at test@example.com or info@domain.org';
    const result = maskEmail(text);
    assert.strictEqual(
      result.masked,
      `Contact me at ${MASK_TOKEN} or ${MASK_TOKEN}`
    );
    assert.strictEqual(result.positions.length, 2);
    assert.deepStrictEqual(result.positions[0], {
      start: 14,
      end: 30,
      original: 'test@example.com',
    });
  });

  it('handles no email addresses', () => {
    const text = 'No emails here';
    const result = maskEmail(text);
    assert.strictEqual(result.masked, text);
    assert.strictEqual(result.positions.length, 0);
  });
});

describe('maskPhone', () => {
  it('masks Japanese phone numbers', () => {
    const text = 'Call 090-1234-5678 or 03-1234-5678';
    const result = maskPhone(text);
    assert.strictEqual(result.masked, `Call ${MASK_TOKEN} or ${MASK_TOKEN}`);
    assert.strictEqual(result.positions.length, 2);
  });

  it('masks phone numbers without hyphens', () => {
    const text = 'Phone: 09012345678';
    const result = maskPhone(text);
    assert.strictEqual(result.masked, `Phone: ${MASK_TOKEN}`);
    assert.strictEqual(result.positions[0]!.original, '09012345678');
  });
});

describe('maskPostalCode', () => {
  it('masks postal codes with symbol', () => {
    const text = 'Address: 〒100-0001 Tokyo';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, `Address: 〒${MASK_TOKEN} Tokyo`);
    assert.strictEqual(result.positions[0]!.original, '100-0001');
  });

  it('masks postal codes without symbol', () => {
    const text = 'ZIP: 123-4567';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, `ZIP: ${MASK_TOKEN}`);
    assert.strictEqual(result.positions[0]!.original, '123-4567');
  });

  it('handles postal codes without hyphen with 〒', () => {
    const text = '〒1234567 東京都';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, `〒${MASK_TOKEN} 東京都`);
  });

  it('does not mask standalone 7-digit number without 〒', () => {
    const text = 'Code: 1234567';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, 'Code: 1234567');
    assert.strictEqual(result.positions.length, 0);
  });

  it('does not mask phone number mid-segment', () => {
    const text = '090-1234-5678';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, '090-1234-5678');
    assert.strictEqual(result.positions.length, 0);
  });

  it('does not mask fixed-line phone number segment', () => {
    const text = '045-123-4567';
    const result = maskPostalCode(text);
    assert.strictEqual(result.masked, '045-123-4567');
    assert.strictEqual(result.positions.length, 0);
  });
});

describe('maskCreditCard', () => {
  it('masks valid credit card numbers', () => {
    const text = 'Card: 4111 1111 1111 1111';
    const result = maskCreditCard(text);
    assert.strictEqual(result.masked, `Card: ${MASK_TOKEN}`);
    assert.strictEqual(result.positions.length, 1);
  });

  it('does not mask invalid credit card numbers', () => {
    const text = 'Invalid: 1234 5678 9012 3456';
    const result = maskCreditCard(text);
    assert.strictEqual(result.masked, text);
    assert.strictEqual(result.positions.length, 0);
  });

  it('masks credit card with hyphens', () => {
    const text = 'CC: 4111-1111-1111-1111';
    const result = maskCreditCard(text);
    assert.strictEqual(result.masked, `CC: ${MASK_TOKEN}`);
  });

  it('handles numbers too short or too long', () => {
    const text = 'Too short: 123456789012 Too long: 12345678901234567890';
    const result = maskCreditCard(text);
    assert.strictEqual(result.masked, text);
    assert.strictEqual(result.positions.length, 0);
  });
});

describe('maskMyNumber', () => {
  it('masks valid My Number', () => {
    const text = 'My Number: 123456789016';
    const result = maskMyNumber(text);
    assert.strictEqual(result.masked, `My Number: ${MASK_TOKEN}`);
    assert.strictEqual(result.positions.length, 1);
  });

  it('does not mask invalid My Number', () => {
    const text = 'Invalid: 123456789019';
    const result = maskMyNumber(text);
    assert.strictEqual(result.masked, text);
    assert.strictEqual(result.positions.length, 0);
  });

  it('masks My Number with hyphens', () => {
    const text = 'ID: 1234-5678-9016';
    const result = maskMyNumber(text);
    assert.strictEqual(result.masked, `ID: ${MASK_TOKEN}`);
  });

  it('handles wrong length numbers', () => {
    const text = 'Wrong: 12345678901';
    const result = maskMyNumber(text);
    assert.strictEqual(result.masked, text);
    assert.strictEqual(result.positions.length, 0);
  });
});
