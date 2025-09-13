import type { SudachiToken, TokenSequence } from '../types/token-types.js';
import {
  isPlaceName,
  getAdministrativeLevelFull,
} from './token-classifiers.js';

function isAddressBlockStopToken(token: SudachiToken): boolean {
  const pos0 = token.poses[0];
  if (!pos0) return false;

  const stopPos = ['動詞', '形容詞', '助動詞', '助詞', '接続詞', '感動詞'];
  if (stopPos.includes(pos0)) return true;

  // 補助記号のうち住所内で使うダッシュ系のみ通す。
  // それ以外の補助記号（引用符・読点・括弧など）は止まり条件とする。
  if (pos0 === '補助記号') {
    const addressSafeDashes = [
      '－', // U+FF0D FULLWIDTH HYPHEN-MINUS
      '—', // U+2014 EM DASH
      '‐', // U+2010 HYPHEN
      '−', // U+2212 MINUS SIGN
    ];
    return !addressSafeDashes.includes(token.surface);
  }

  const stopSurfaces = ['。', '！', '？', '\n', '\r', '（', '）', '「', '」'];
  return stopSurfaces.includes(token.surface);
}

/**
 * 住所ブロック検出。
 * アンカー:
 *   - 都道府県トークン: ブロックは都道府県の直後から開始
 *   - 地名 + 市区町村レベル接尾辞: ブロックは地名から開始
 * 統一ガード: アンカー後3トークン以内に行政区分トークンが必要
 */
export function findAddressBlocks(tokens: SudachiToken[]): TokenSequence[] {
  const blocks: TokenSequence[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    let blockStartIndex: number;
    let checkFrom: number;

    const adminLevel = getAdministrativeLevelFull(token);
    if (adminLevel.level === 'prefecture') {
      blockStartIndex = i + 1;
      checkFrom = i + 1;
    } else if (isPlaceName(token)) {
      const next = tokens[i + 1];
      if (!next || token.end !== next.start) continue;
      if (getAdministrativeLevelFull(next).level !== 'city') continue;
      blockStartIndex = i;
      checkFrom = i + 2;
    } else {
      continue;
    }

    // 統一ガード: アンカー後3トークン以内に別の行政区分トークンが必要
    let hasNextAdmin = false;
    for (let k = checkFrom; k < checkFrom + 3 && k < tokens.length; k++) {
      const t = tokens[k];
      if (t && getAdministrativeLevelFull(t).isAdministrative) {
        hasNextAdmin = true;
        break;
      }
    }
    if (!hasNextAdmin) continue;

    // 停止トークンまでトークンを収集
    const blockTokens: SudachiToken[] = [];
    let lastBlockIndex = blockStartIndex;
    for (let j = blockStartIndex; j < tokens.length; j++) {
      const t = tokens[j];
      if (!t || isAddressBlockStopToken(t)) break;
      blockTokens.push(t);
      lastBlockIndex = j;
    }

    if (blockTokens.length > 0) {
      const first = blockTokens[0]!;
      const last = blockTokens[blockTokens.length - 1]!;
      blocks.push({
        start: first.start,
        end: last.end,
        text: blockTokens.map(t => t.surface).join(''),
        tokens: blockTokens,
      });
      // 既にカバーしたトークンを再処理しないようにループを進める
      i = lastBlockIndex;
    }
  }

  return blocks;
}
