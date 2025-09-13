import type { SudachiToken } from '../types/token-types.js';
import { findAddressBlocks } from './address-block-detector.js';
import {
  findCompoundPlaceNames,
  isCompoundPlaceInAddressContext,
} from './compound-place-detector.js';
import { findNameSequences } from './name-sequence-detector.js';
import { reanchorPosition } from './position-anchor.js';

export interface DetectedItem {
  text: string;
  start: number;
  end: number;
  type: 'surname' | 'given_name' | 'place';
}

function hasAddressContextBefore(
  allTokens: SudachiToken[],
  currentIndex: number
): boolean {
  const extendedContextSize = 10;
  const startCheck = Math.max(0, currentIndex - extendedContextSize);
  const endCheck = Math.min(
    allTokens.length,
    currentIndex + extendedContextSize
  );
  const contextText = allTokens
    .slice(startCheck, endCheck)
    .map(t => t.surface)
    .join('');

  const jsonApiPatterns = [
    /["'][^"']*["']\s*[:：]\s*/,
    /["'][^"']*Id["']/,
    /["'][^"']*[Kk]ey["']/,
    /["'][^"']*[Tt]oken["']/,
    /["'][^"']*[Hh]ash["']/,
    /["'][^"']*[Cc]ode["']/,
    /["'][^"']*[Uu]uid["']/,
    /["'][^"']*[Cc]ount["']/,
    /["'][^"']*[Dd]ata["']/,
  ];

  if (jsonApiPatterns.some(p => p.test(contextText))) {
    console.log(
      `🚫 JSON/APIコンテキストのため住所検出をスキップ: "${contextText}"`
    );
    return false;
  }

  const contextSize = 5;
  const startIndex = Math.max(0, currentIndex - contextSize);
  for (let i = startIndex; i < currentIndex; i++) {
    const token = allTokens[i];
    if (!token) continue;

    const isPlaceToken =
      token.poses.length >= 3 &&
      token.poses[0] === '名詞' &&
      token.poses[1] === '固有名詞' &&
      token.poses[2] === '地名';
    const isNumber = /^\d+$/.test(token.surface);
    const adminSuffixes = ['県', '府', '都', '道', '市', '町', '村', '区'];
    const isAdminSuffix = adminSuffixes.includes(token.surface);

    if (isPlaceToken || isNumber || isAdminSuffix) return true;
  }

  return false;
}

/**
 * 分割された地名の再結合（長町のような地名+町の組み合わせ）
 */
function reconstructSplitPlaceNames(allTokens: SudachiToken[]): DetectedItem[] {
  const reconstructed: DetectedItem[] = [];

  for (let i = 0; i < allTokens.length - 1; i++) {
    const currentToken = allTokens[i];
    const nextToken = allTokens[i + 1];
    if (!currentToken || !nextToken) continue;

    if (currentToken.surface.endsWith('区長') && nextToken.surface === '町') {
      const placePart = currentToken.surface.slice(-1);
      if (placePart !== '長') continue;

      if (hasAddressContextBefore(allTokens, i)) {
        const placeStart = currentToken.end - 1;
        reconstructed.push({
          text: placePart + nextToken.surface,
          start: placeStart,
          end: nextToken.end,
          type: 'place',
        });
      }
    }
  }

  return reconstructed;
}

/**
 * 形態素解析トークンから個人情報を検出する
 */
export function runDetectionPipeline(params: {
  text: string;
  allTokens: SudachiToken[];
}): DetectedItem[] {
  const { text, allTokens } = params;
  const names: DetectedItem[] = [];
  const processedTokens = new Set<SudachiToken>();
  const coveredRanges: Array<{ start: number; end: number }> = [];
  const overlapsWithCovered = (s: number, e: number): boolean =>
    coveredRanges.some(r => s < r.end && e > r.start);

  // 住所ブロック検出（最高優先度）
  for (const block of findAddressBlocks(allTokens)) {
    const pos = reanchorPosition(block.text, block.start, text);
    names.push({ text: block.text, ...pos, type: 'place' });
    block.tokens.forEach(t => processedTokens.add(t));
    coveredRanges.push(pos);
  }

  // 複合地名検出
  for (const compound of findCompoundPlaceNames(allTokens)) {
    if (compound.tokens.some(t => processedTokens.has(t))) continue;
    if (isCompoundPlaceInAddressContext(compound, allTokens)) {
      const pos = reanchorPosition(compound.text, compound.start, text);
      names.push({ text: compound.text, ...pos, type: 'place' });
      compound.tokens.forEach(t => processedTokens.add(t));
    }
  }

  // 人名シーケンス検出
  for (const nameSeq of findNameSequences(allTokens)) {
    if (nameSeq.tokens.some(t => processedTokens.has(t))) continue;
    const pos = reanchorPosition(nameSeq.text, nameSeq.start, text);
    names.push({ text: nameSeq.text, ...pos, type: 'surname' });
    nameSeq.tokens.forEach(t => processedTokens.add(t));
  }

  // 分割された地名の再結合
  for (const place of reconstructSplitPlaceNames(allTokens)) {
    const pos = reanchorPosition(place.text, place.start, text);
    if (!overlapsWithCovered(pos.start, pos.end)) {
      names.push({ ...place, ...pos });
    }
  }

  return names;
}
