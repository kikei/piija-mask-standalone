// reanchorPosition のユニットテスト
//
// Sudachi は surface に正規化後の文字列を返すため、
// "(TEL)" (5文字) が "（℡)" (3文字) に正規化されると
// surface 累積位置が原文より2文字分手前にずれる。
// reanchorPosition はその概算位置を起点に原文を前向き検索して補正する。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { reanchorPosition } from '../src/analyzers/position-anchor.js';


describe('reanchorPosition', () => {
  describe('正規化なし（概算位置が正確な場合）', () => {
    it('approxStart が実際の位置と一致する場合はそのまま返す', () => {
      const result = reanchorPosition('藤井太郎', 0, '藤井太郎に連絡');
      assert.strictEqual(result.start, 0);
      assert.strictEqual(result.end, 4);
    });

    it('テキスト中間に名前がある場合', () => {
      // "宛先: " = 宛(0)+先(1)+:(2)+space(3) = 4文字 → 藤井太郎は@4
      const result = reanchorPosition('藤井太郎', 4, '宛先: 藤井太郎');
      assert.strictEqual(result.start, 4);
      assert.strictEqual(result.end, 8);
    });
  });

  describe('(TEL) 正規化によるオフセットズレの補正', () => {
    // "(TEL)" (5文字) → surface "（℡)" (3文字) のとき
    // 後続トークンの概算位置が実際より2文字手前にずれる
    it('approxStart がずれていても前向き検索で正しい位置を返す', () => {
      const original = '(TEL) 03-6620-1234 藤井太郎';
      // 実際の「藤井太郎」の位置: 19–23
      // surface 累積での概算位置: 17（2文字ずれ）
      const result = reanchorPosition('藤井太郎', 17, original);
      assert.strictEqual(result.start, 19);
      assert.strictEqual(result.end, 23);
    });

    it('(TEL) の直後の名前も正しく補正される', () => {
      const original = '(TEL) 藤井太郎';
      // surface 累積: "（"(1)+"℡"(1)+")"(1)+" "(1) = 4 → approxStart=4
      // 実際: "("(1)+"T"(1)+"E"(1)+"L"(1)+")"(1)+" "(1) = 6
      const result = reanchorPosition('藤井太郎', 4, original);
      assert.strictEqual(result.start, 6);
      assert.strictEqual(result.end, 10);
    });
  });

  describe('同一名前が複数出現する場合', () => {
    it('approxStart を起点に検索するため正しい出現を選べる', () => {
      // "送付先: " = 5文字 → 1回目@5、"\n注文者: " = 6文字 → 2回目@15
      const original = '送付先: 藤井太郎\n注文者: 藤井太郎';
      // 1回目: approxStart=5 (正確)
      const first = reanchorPosition('藤井太郎', 5, original);
      assert.strictEqual(first.start, 5);
      assert.strictEqual(first.end, 9);
      // 2回目: approxStart=13（2文字ずれ）→ indexOf で 15 を発見
      const second = reanchorPosition('藤井太郎', 13, original);
      assert.strictEqual(second.start, 15);
      assert.strictEqual(second.end, 19);
    });

    it('2回目の approxStart がずれていても正しい出現を選ぶ', () => {
      // (TEL) 正規化で4文字ずれた場合: approxStart=11（実際は15）
      const original = '送付先: 藤井太郎\n注文者: 藤井太郎';
      const second = reanchorPosition('藤井太郎', 11, original);
      assert.strictEqual(second.start, 15);
      assert.strictEqual(second.end, 19);
    });
  });

  describe('フォールバック動作', () => {
    it('approxStart より後に見つからない場合は全文検索にフォールバックする', () => {
      // approxStart が実際の位置より後ろ（異常系）
      const result = reanchorPosition('藤井太郎', 20, '藤井太郎への連絡');
      assert.strictEqual(result.start, 0);
      assert.strictEqual(result.end, 4);
    });
  });
});
