import type { SudachiToken, TokenSequence } from '../types/token-types.js';
import {
  isPlaceName,
  getAdministrativeLevelFull,
} from './token-classifiers.js';

/**
 * 複合地名検出（地名＋普通名詞の組み合わせ）
 * 例: "横浜"+"市"+"中"+"区" → "横浜市中区"
 * 都道府県接尾辞（県/府/都/道）で停止。
 */
export function findCompoundPlaceNames(
  tokens: SudachiToken[]
): TokenSequence[] {
  const compounds: TokenSequence[] = [];
  const prefectureSuffixes = ['県', '府', '都', '道'];

  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];
    if (!currentToken) continue;
    if (!isPlaceName(currentToken)) continue;

    const compoundTokens: SudachiToken[] = [currentToken];
    let j = i + 1;
    while (j < tokens.length) {
      const nextToken = tokens[j];
      if (!nextToken) break;
      const prev = compoundTokens[compoundTokens.length - 1]!;
      if (prev.end !== nextToken.start) break;
      if (prefectureSuffixes.includes(nextToken.surface)) break;
      const isGeneralNoun =
        nextToken.poses[0] === '名詞' && nextToken.poses[1] === '普通名詞';
      const isSuffix =
        nextToken.poses[0] === '接尾辞' && nextToken.poses[1] === '名詞的';
      if (!isGeneralNoun && !isSuffix) break;
      compoundTokens.push(nextToken);
      j++;
    }

    if (compoundTokens.length > 1) {
      const lastToken = compoundTokens[compoundTokens.length - 1]!;
      compounds.push({
        text: compoundTokens.map(t => t.surface).join(''),
        start: currentToken.start,
        end: lastToken.end,
        tokens: compoundTokens,
      });
    }
  }

  return compounds;
}

function getTokensContext(
  tokens: SudachiToken[],
  offset: number,
  contextSize = 5
): { before: SudachiToken[]; after: SudachiToken[] } | null {
  const currentToken = tokens.find(t => t.start <= offset && offset < t.end);
  if (!currentToken) return null;
  const idx = tokens.indexOf(currentToken);
  const before = tokens.slice(Math.max(0, idx - contextSize), idx).reverse();
  const after = tokens.slice(idx + 1, idx + 1 + contextSize);
  return { before, after };
}

/**
 * 複合地名が個人識別可能な住所コンテキストにあるかチェック
 */
export function isCompoundPlaceInAddressContext(
  compound: TokenSequence,
  tokens: SudachiToken[]
): boolean {
  const startCtx = getTokensContext(tokens, compound.start);
  if (!startCtx) return false;

  const lastToken = compound.tokens[compound.tokens.length - 1];
  const endCtx = lastToken
    ? getTokensContext(tokens, lastToken.start)
    : startCtx;

  const addressPattern = /^\d+(-\d+)*$/;
  const addressKeywords = ['番地', '号', '丁目'];
  const afterContext = endCtx ?? startCtx;
  const hasAddressNumbers = afterContext.after.some(
    token =>
      addressPattern.test(token.surface) ||
      addressKeywords.some(kw => token.surface.includes(kw))
  );

  // 複合地名が行政区分接尾辞で終わる場合は番地のみで十分
  if (lastToken && getAdministrativeLevelFull(lastToken).isAdministrative) {
    return hasAddressNumbers;
  }

  // そうでない場合は前に行政区分コンテキスト＋番地の両方が必要
  const hasAdminContext = startCtx.before.some(
    t => getAdministrativeLevelFull(t).isAdministrative
  );
  return hasAdminContext && hasAddressNumbers;
}
