// TokenSequenceAnalyzer のユニットテスト
// 特に「都道府県名はマスクしない」仕様を保証する
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TokenSequenceAnalyzer } from '../src/token-analyzer.js';
import { findNameSequences } from '../src/analyzers/name-sequence-detector.js';
import { getAdministrativeLevel } from '../src/analyzers/token-classifiers.js';
import type { SudachiToken } from '../src/types/token-types.js';

/** テスト用トークン生成ヘルパー */
function token(surface: string, poses: string[], start: number): SudachiToken {
  return { surface, poses, start, end: start + surface.length };
}

// ─────────────────────────────────────────────────────
// 仕様: 都道府県名はマスクしない（アドレスブロックに含めない）
//
// findAddressBlocks() は都道府県トークン（県/府/都/道 で終わる）を
// アンカーとして使うが、ブロックの開始は「都道府県の次のトークン」から。
// したがって「東京都」「大阪府」などの文字列は出力に残る。
//
// 詳細: docs/MASK.md §2.7 参照
// ─────────────────────────────────────────────────────

describe('TokenSequenceAnalyzer.findAddressBlocks', () => {
  describe('都道府県名はブロックに含まれない（仕様）', () => {
    it('県で終わる都道府県トークンはブロックに含まれない', () => {
      // 「埼玉県さいたま市浦和区1」
      const tokens: SudachiToken[] = [
        token('埼玉県', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('さいたま', ['名詞', '固有名詞', '地名', '一般'], 3),
        token('市', ['接尾辞', '名詞的', '一般'], 7),
        token('浦和', ['名詞', '固有名詞', '地名', '一般'], 8),
        token('区', ['接尾辞', '名詞的', '一般'], 10),
        token('1', ['名詞', '数詞'], 11),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(blocks.length, 1);
      // ブロックは「さいたま市浦和区1」で始まる（「埼玉県」を含まない）
      assert.ok(
        blocks[0].start >= 3,
        `ブロック開始 ${blocks[0].start} が都道府県トークン終端 3 以上であること`
      );
      assert.ok(
        !blocks[0].text.includes('埼玉県'),
        `ブロックテキスト "${blocks[0].text}" が都道府県名を含まないこと`
      );
    });

    it('府で終わる都道府県トークンはブロックに含まれない', () => {
      // 「京都府京都市北区1丁目」
      const tokens: SudachiToken[] = [
        token('京都府', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('京都', ['名詞', '固有名詞', '地名', '一般'], 3),
        token('市', ['接尾辞', '名詞的', '一般'], 5),
        token('北', ['名詞', '固有名詞', '地名', '一般'], 6),
        token('区', ['接尾辞', '名詞的', '一般'], 7),
        token('1', ['名詞', '数詞'], 8),
        token('丁目', ['名詞', '普通名詞', '一般'], 9),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(blocks.length, 1);
      assert.ok(
        blocks[0].start >= 3,
        `ブロック開始 ${blocks[0].start} が都道府県トークン終端 3 以上であること`
      );
      assert.ok(
        !blocks[0].text.includes('京都府'),
        `ブロックテキスト "${blocks[0].text}" が都道府県名を含まないこと`
      );
    });

    it('都で終わる都道府県トークンはブロックに含まれない', () => {
      // 「東京都千代田区1丁目」
      const tokens: SudachiToken[] = [
        token('東京都', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('千代田', ['名詞', '固有名詞', '地名', '一般'], 3),
        token('区', ['接尾辞', '名詞的', '一般'], 6),
        token('1', ['名詞', '数詞'], 7),
        token('丁目', ['名詞', '普通名詞', '一般'], 8),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(blocks.length, 1);
      assert.ok(
        blocks[0].start >= 3,
        `ブロック開始 ${blocks[0].start} が都道府県トークン終端 3 以上であること`
      );
      assert.ok(
        !blocks[0].text.includes('東京都'),
        `ブロックテキスト "${blocks[0].text}" が都道府県名を含まないこと`
      );
    });

    it('道で終わる都道府県トークンはブロックに含まれない', () => {
      // 「北海道札幌市北区2条1丁目」
      const tokens: SudachiToken[] = [
        token('北海道', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('札幌', ['名詞', '固有名詞', '地名', '一般'], 3),
        token('市', ['接尾辞', '名詞的', '一般'], 5),
        token('北', ['名詞', '固有名詞', '地名', '一般'], 6),
        token('区', ['接尾辞', '名詞的', '一般'], 7),
        token('2', ['名詞', '数詞'], 8),
        token('条', ['名詞', '普通名詞', '一般'], 9),
        token('1', ['名詞', '数詞'], 10),
        token('丁目', ['名詞', '普通名詞', '一般'], 11),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(blocks.length, 1);
      assert.ok(
        blocks[0].start >= 3,
        `ブロック開始 ${blocks[0].start} が都道府県トークン終端 3 以上であること`
      );
      assert.ok(
        !blocks[0].text.includes('北海道'),
        `ブロックテキスト "${blocks[0].text}" が都道府県名を含まないこと`
      );
    });
  });

  describe('都道府県なしの住所（市区から始まる場合）', () => {
    it('都道府県なしで市から始まる住所はブロック全体に含まれる', () => {
      // 「仙台市青葉区1丁目」（都道府県なし）
      // city-anchor パス: 地名「仙台」+ 市 → ブロックは「仙台」から
      const tokens: SudachiToken[] = [
        token('仙台', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('市', ['接尾辞', '名詞的', '一般'], 2),
        token('青葉', ['名詞', '固有名詞', '地名', '一般'], 3),
        token('区', ['接尾辞', '名詞的', '一般'], 5),
        token('1', ['名詞', '数詞'], 6),
        token('丁目', ['名詞', '普通名詞', '一般'], 7),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(blocks.length, 1);
      // city-anchor では地名自体からブロックが始まる
      assert.strictEqual(blocks[0].start, 0);
      assert.ok(
        blocks[0].text.startsWith('仙台'),
        `city-anchor ブロックは市名から始まること`
      );
    });
  });

  describe('ガード条件（後続に行政区分がない場合はブロックを生成しない）', () => {
    it('都道府県の後に行政区分がない場合はブロックを生成しない', () => {
      // 「東京都知事」（都道府県の後が行政区分でない）
      const tokens: SudachiToken[] = [
        token('東京都', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('知事', ['名詞', '普通名詞', '一般'], 3),
        token('が', ['助詞', '格助詞'], 5),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(
        blocks.length,
        0,
        '後続に行政区分がない場合はブロックを生成しない'
      );
    });
  });
});

// ─────────────────────────────────────────────────────
// 誤検知回帰テスト
//
// 削除した detectAlphanumericAddresses / findAddressNumberSequences
// が引き起こしていた誤検知ケースを記録し、再発を防ぐ。
// ─────────────────────────────────────────────────────

describe('TokenSequenceAnalyzer 誤検知回帰', () => {
  describe('地名トークン直後の数字をアドレスブロックに含めない', () => {
    it('「いしかり就航15周年」は地名＋数字の誤検知を起こさない', () => {
      // Sudachi 実測: いしかり(地名) 就航(普通名詞) 1(数詞) 5(数詞) 周年(普通名詞)
      // 行政区分サフィックス（市/区/町/村）がないので city-anchor にならない
      const tokens: SudachiToken[] = [
        token('いしかり', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('就航', ['名詞', '普通名詞', 'サ変可能'], 4),
        token('1', ['名詞', '数詞'], 6),
        token('5', ['名詞', '数詞'], 7),
        token('周年', ['名詞', '普通名詞', '一般'], 8),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(
        blocks.length,
        0,
        'フェリー名「いしかり」直後の数字はアドレスブロックを生成しない'
      );
    });

    it('都道府県なし・行政区分なしの地名単独ではブロックを生成しない', () => {
      // 例: 「石狩市イベント2025年」— 市があっても後続に行政区分がなければ不可
      // ただしここでは「石狩」+ 非行政名詞 + 数字 の最小例
      const tokens: SudachiToken[] = [
        token('石狩', ['名詞', '固有名詞', '地名', '一般'], 0),
        token('産業', ['名詞', '普通名詞', '一般'], 2),
        token('15', ['名詞', '数詞'], 4),
      ];
      const analyzer = new TokenSequenceAnalyzer(tokens);
      const blocks = analyzer.findAddressBlocks();

      assert.strictEqual(
        blocks.length,
        0,
        '地名＋普通名詞＋数字のパターンはアドレスブロックにならない'
      );
    });
  });
});

describe('getAdministrativeLevel', () => {
  it('都道府県（県/府/都/道）を prefecture として認識する', () => {
    const prefectures = [
      token('愛知県', ['名詞', '固有名詞', '地名', '一般'], 0),
      token('大阪府', ['名詞', '固有名詞', '地名', '一般'], 0),
      token('東京都', ['名詞', '固有名詞', '地名', '一般'], 0),
      token('北海道', ['名詞', '固有名詞', '地名', '一般'], 0),
    ];
    for (const t of prefectures) {
      const result = getAdministrativeLevel(t);
      assert.strictEqual(
        result.level,
        'prefecture',
        `${t.surface} は prefecture であること`
      );
      assert.strictEqual(result.isAdministrative, true);
    }
  });

  it('市区はprefectureでなくcityとして認識する', () => {
    const cityTokens = [
      token('横浜市', ['名詞', '固有名詞', '地名', '一般'], 0),
      token('中区', ['名詞', '固有名詞', '地名', '一般'], 0),
    ];
    for (const t of cityTokens) {
      const result = getAdministrativeLevel(t);
      assert.strictEqual(result.level, 'city');
      assert.notStrictEqual(result.level, 'prefecture');
    }
  });
});

// ─────────────────────────────────────────────────────
// findNameSequences のユニットテスト
//
// 姓+名・姓+敬称・姓単体（行末/句読点）を検出し、
// 非敬称接尾辞（屋など）では検出しないことを保証する。
// ─────────────────────────────────────────────────────

describe('findNameSequences', () => {
  const surname = (surface: string, start: number) =>
    token(surface, ['名詞', '固有名詞', '人名', '姓', '*', '*'], start);
  const givenName = (surface: string, start: number) =>
    token(surface, ['名詞', '固有名詞', '人名', '名', '*', '*'], start);
  const honorific = (surface: string, start: number) =>
    token(surface, ['接尾辞', '名詞的', '一般', '*', '*', '*'], start);

  describe('姓+名の組み合わせ', () => {
    it('「藤井太郎」（姓+名）が検出される', () => {
      const tokens: SudachiToken[] = [surname('藤井', 0), givenName('太郎', 2)];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].text, '藤井太郎');
      assert.strictEqual(result[0].start, 0);
      assert.strictEqual(result[0].end, 4);
    });
  });

  describe('姓+敬称（接尾辞）→ 姓のみ検出', () => {
    for (const suffix of ['さん', '様', 'くん', '君', '氏', '殿']) {
      it(`「藤井${suffix}」の姓部分「藤井」が検出される`, () => {
        const tokens: SudachiToken[] = [
          surname('藤井', 0),
          honorific(suffix, 2),
        ];
        const result = findNameSequences(tokens);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].text, '藤井');
        assert.strictEqual(result[0].end, 2);
      });
    }
  });

  describe('姓単体が名前終端に続く場合', () => {
    it('テキスト末尾の姓単体「佐藤」が検出される', () => {
      const tokens: SudachiToken[] = [surname('佐藤', 0)];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].text, '佐藤');
    });

    it('句点（補助記号）の直前の姓単体「佐藤」が検出される', () => {
      const tokens: SudachiToken[] = [
        surname('佐藤', 0),
        token('。', ['補助記号', '句点', '*', '*', '*', '*'], 2),
      ];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].text, '佐藤');
      assert.strictEqual(result[0].end, 2);
    });

    it('改行（空白）の直前の姓単体「佐藤」が検出される', () => {
      const tokens: SudachiToken[] = [
        surname('佐藤', 0),
        token('\n', ['空白', '*', '*', '*', '*', '*'], 2),
      ];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].text, '佐藤');
      assert.strictEqual(result[0].end, 2);
    });
  });

  describe('誤検知しないケース', () => {
    it('非敬称の接尾辞「屋」が続く姓単体は検出されない', () => {
      const tokens: SudachiToken[] = [surname('中村', 0), honorific('屋', 2)];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 0);
    });

    it('助詞が続く姓単体は検出されない', () => {
      const tokens: SudachiToken[] = [
        surname('藤井', 0),
        token('の', ['助詞', '格助詞', '*', '*', '*', '*'], 2),
      ];
      const result = findNameSequences(tokens);
      assert.strictEqual(result.length, 0);
    });
  });
});
