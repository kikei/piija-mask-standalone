import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isNumericToken,
  isAddressSymbolToken,
  isPlaceName,
  isPersonName,
  getAdministrativeLevel,
  getAdministrativeLevelFull,
  isHalfWidthKatakanaName,
} from '../src/analyzers/token-classifiers.js';
import type { SudachiToken } from '../src/types/token-types.js';

function makeToken(surface: string, poses: string[], start = 0): SudachiToken {
  return { surface, poses, start, end: start + surface.length };
}

describe('token-classifiers', () => {
  describe('isNumericToken', () => {
    it('returns true for 数詞 token', () => {
      assert.strictEqual(
        isNumericToken(makeToken('123', ['名詞', '数詞'])),
        true
      );
    });

    it('returns false for non-numeric token', () => {
      assert.strictEqual(
        isNumericToken(makeToken('abc', ['名詞', '普通名詞'])),
        false
      );
    });
  });

  describe('isAddressSymbolToken', () => {
    it('returns true for hyphen 補助記号', () => {
      assert.strictEqual(
        isAddressSymbolToken(makeToken('-', ['補助記号', '一般'])),
        true
      );
    });

    it('returns false for non-symbol token', () => {
      assert.strictEqual(
        isAddressSymbolToken(makeToken('a', ['名詞', '普通名詞'])),
        false
      );
    });
  });

  describe('isPlaceName', () => {
    it('returns true for 地名 token', () => {
      assert.strictEqual(
        isPlaceName(makeToken('東京', ['名詞', '固有名詞', '地名', '一般'])),
        true
      );
    });

    it('returns false for 人名 token', () => {
      assert.strictEqual(
        isPlaceName(makeToken('太郎', ['名詞', '固有名詞', '人名', '名'])),
        false
      );
    });
  });

  describe('isPersonName', () => {
    it('detects 姓 token', () => {
      const result = isPersonName(
        makeToken('山田', ['名詞', '固有名詞', '人名', '姓'])
      );
      assert.strictEqual(result.isPersonName, true);
      assert.strictEqual(result.type, 'surname');
    });

    it('detects 名 token', () => {
      const result = isPersonName(
        makeToken('太郎', ['名詞', '固有名詞', '人名', '名'])
      );
      assert.strictEqual(result.isPersonName, true);
      assert.strictEqual(result.type, 'given_name');
    });

    it('returns false for place name token', () => {
      const result = isPersonName(
        makeToken('東京', ['名詞', '固有名詞', '地名'])
      );
      assert.strictEqual(result.isPersonName, false);
    });
  });

  describe('getAdministrativeLevel (strict: 市/区のみ)', () => {
    it('detects prefecture', () => {
      const r = getAdministrativeLevel(makeToken('県', ['名詞', '普通名詞']));
      assert.strictEqual(r.isAdministrative, true);
      assert.strictEqual(r.level, 'prefecture');
    });

    it('detects city (市)', () => {
      const r = getAdministrativeLevel(makeToken('市', ['名詞', '普通名詞']));
      assert.strictEqual(r.isAdministrative, true);
      assert.strictEqual(r.level, 'city');
    });

    it('returns null for 町 (excluded by design)', () => {
      const r = getAdministrativeLevel(makeToken('町', ['名詞', '普通名詞']));
      assert.strictEqual(r.isAdministrative, false);
    });

    it('returns null for non-admin token', () => {
      const r = getAdministrativeLevel(makeToken('大輪', ['名詞', '普通名詞']));
      assert.strictEqual(r.isAdministrative, false);
    });
  });

  describe('getAdministrativeLevelFull (住所用: 町・村も含む)', () => {
    it('detects 町 as city', () => {
      const r = getAdministrativeLevelFull(
        makeToken('町', ['名詞', '普通名詞'])
      );
      assert.strictEqual(r.isAdministrative, true);
      assert.strictEqual(r.level, 'city');
    });

    it('detects 村 as city', () => {
      const r = getAdministrativeLevelFull(
        makeToken('村', ['名詞', '普通名詞'])
      );
      assert.strictEqual(r.isAdministrative, true);
      assert.strictEqual(r.level, 'city');
    });
  });

  describe('isHalfWidthKatakanaName', () => {
    it('returns true for half-width katakana 2+ chars', () => {
      assert.strictEqual(isHalfWidthKatakanaName('ｱｲｳｴｵ'), true);
    });

    it('returns false for full-width katakana', () => {
      assert.strictEqual(isHalfWidthKatakanaName('アイウエオ'), false);
    });

    it('returns false for single char', () => {
      assert.strictEqual(isHalfWidthKatakanaName('ｱ'), false);
    });
  });
});
