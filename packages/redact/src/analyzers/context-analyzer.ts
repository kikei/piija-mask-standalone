// コンテキスト解析器
import type { SudachiToken, TokenContext } from '../types/token-types.js';

/**
 * 指定位置のトークンのコンテキストを取得
 */
export function getTokenContext(
  tokens: SudachiToken[],
  offset: number,
  length: number,
  contextSize: number = 5
): TokenContext | null {
  const currentToken = findTokenAt(tokens, offset);
  if (!currentToken) return null;

  const currentIndex = tokens.indexOf(currentToken);
  if (currentIndex === -1) return null;

  const before = tokens
    .slice(Math.max(0, currentIndex - contextSize), currentIndex)
    .reverse();
  const after = tokens.slice(currentIndex + 1, currentIndex + 1 + contextSize);

  return {
    current: currentToken,
    before,
    after,
    index: currentIndex,
    allTokens: tokens,
  };
}

/**
 * 指定位置のトークンを検索
 */
export function findTokenAt(
  tokens: SudachiToken[],
  offset: number
): SudachiToken | null {
  return (
    tokens.find(token => token.start <= offset && offset < token.end) || null
  );
}
