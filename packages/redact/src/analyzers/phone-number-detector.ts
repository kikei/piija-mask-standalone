// 電話番号検出器

/**
 * 日本および国際電話番号のパターン（厳密な桁数・構造のみ）。
 * \s を含めず、ハイフン区切りのみを認める。
 * 順序は具体的なものを先に（交替の先勝ちで重複を防ぐ）。
 */
const PHONE_PATTERNS = [
  // 国際番号: +1-800-1234-5678, +81-90-1234-5678 等
  String.raw`\+\d{1,3}-\d{1,4}-\d{4}-\d{4}`,
  // 携帯(ハイフン): 090-1234-5678
  String.raw`0[789]0-\d{4}-\d{4}`,
  // 固定 市外2桁+4+4: 03-1234-5678
  String.raw`0[1-9]-\d{4}-\d{4}`,
  // 固定 市外3桁+3+4: 045-123-4567
  String.raw`0\d{2}-\d{3}-\d{4}`,
  // 固定 市外4桁+2+4: 0123-45-6789
  String.raw`0\d{3}-\d{2}-\d{4}`,
  // 固定 市外5桁+1+4: 01234-5-6789
  String.raw`0\d{4}-\d-\d{4}`,
  // 括弧形式: 03(1234)5678, 045(123)4567
  String.raw`0\d{1,4}\(\d{2,4}\)\d{4}`,
  // 携帯 区切りなし 11桁: 09012345678
  String.raw`0[789]0\d{8}`,
  // 固定 区切りなし 10桁: 0312345678
  String.raw`0[1-9]\d{9}`,
];

/**
 * 境界条件:
 * - 直前が [\d_+\-] でない（数字・アンダースコア・プラス・ハイフンの連続を除外）
 * - 直後も同様
 */
export const PHONE_REGEX = new RegExp(
  `(?<![\\d_+\\-])(?:${PHONE_PATTERNS.join('|')})(?![\\d_+\\-])`,
  'g'
);

/**
 * テキスト中の電話番号を検出して位置情報の配列を返す。
 */
export function detectPhoneNumbers(text: string): Array<{
  text: string;
  start: number;
  end: number;
  type: 'phone_number';
}> {
  const results: Array<{
    text: string;
    start: number;
    end: number;
    type: 'phone_number';
  }> = [];

  // RegExp オブジェクトを再生成して lastIndex をリセット
  const regex = new RegExp(PHONE_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'phone_number',
    });
  }

  return results;
}

