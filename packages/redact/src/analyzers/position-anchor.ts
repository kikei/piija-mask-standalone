/**
 * Sudachi の surface 正規化によるオフセットズレを補正する。
 *
 * Sudachi はトークンの surface として正規化後の文字列を返すため、
 * 例えば "(TEL)" (5文字) が "（℡)" (3文字) に正規化されると、
 * surface.length 累積で求めた位置が原文より手前にずれる。
 *
 * 本関数はトークン位置（概算）を起点に原文を前向き検索し、
 * 検出テキストの正確な start/end を返す。
 * 日本語の固有名詞・住所は正規化後も同一文字列なので indexOf で必ず発見できる。
 * 電話番号・郵便番号は detectPhoneNumbers/detectPostalCodes が原文直接処理するため対象外。
 */
export function reanchorPosition(
  detectedText: string,
  approxStart: number,
  originalText: string
): { start: number; end: number } {
  const idx = originalText.indexOf(detectedText, approxStart);
  if (idx !== -1) return { start: idx, end: idx + detectedText.length };
  // approxStart <= actualStart が理論的保証だが、念のため全文検索
  const fallback = originalText.indexOf(detectedText);
  if (fallback !== -1) {
    return { start: fallback, end: fallback + detectedText.length };
  }
  return { start: approxStart, end: approxStart + detectedText.length };
}
