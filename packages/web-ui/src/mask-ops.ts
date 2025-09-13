import { hasOverlap, checkOverlapWithAny, type Position } from './position.js';
import {
  applyMasksToText,
  findAllOccurrences,
  splitSelectionByNewlines,
} from './mask-applier.js';
import type { MaskState } from './app-state.js';

export function removePositionByTokenId(
  tokenId: string,
  state: MaskState
): void {
  state.unmaskedPositions.delete(tokenId);
  state.positions = state.positions.filter(
    p => `${p.start}-${p.end}` !== tokenId
  );
  state.manualMasks = state.manualMasks.filter(
    p => `${p.start}-${p.end}` !== tokenId
  );
}

export function findExactMask(
  start: number,
  end: number,
  state: MaskState
): Position | undefined {
  return [...state.positions, ...state.manualMasks].find(
    p => p.start === start && p.end === end
  );
}

export function findOverlappingMasks(
  start: number,
  end: number,
  state: MaskState
): Position[] {
  const range: Position = { start, end, original: '' };
  return [...state.positions, ...state.manualMasks].filter(p =>
    hasOverlap(range, p)
  );
}

export function findUnmaskedOverlapping(
  start: number,
  end: number,
  state: MaskState
): Position[] {
  const drag: Position = { start, end, original: '' };
  return [...state.positions, ...state.manualMasks].filter(pos => {
    const tokenId = `${pos.start}-${pos.end}`;
    return state.unmaskedPositions.has(tokenId) && hasOverlap(drag, pos);
  });
}

export function splitMaskAround(params: {
  pos: Position;
  holeStart: number;
  holeEnd: number;
  state: MaskState;
}): void {
  const { pos, holeStart, holeEnd, state } = params;
  removePositionByTokenId(`${pos.start}-${pos.end}`, state);
  if (pos.start < holeStart) {
    state.manualMasks.push({
      start: pos.start,
      end: holeStart,
      original: state.originalText.slice(pos.start, holeStart),
    });
  }
  if (holeEnd < pos.end) {
    state.manualMasks.push({
      start: holeEnd,
      end: pos.end,
      original: state.originalText.slice(holeEnd, pos.end),
    });
  }
}

/**
 * テキストの全出現箇所に対してマスクを伝播する。
 * skipStart の出現はスキップする。
 * 変更があった場合は true を返す。
 */
export function propagateMask(params: {
  text: string;
  skipStart: number;
  state: MaskState;
}): boolean {
  const { text, skipStart, state } = params;
  const occurrences = findAllOccurrences(state.originalText, text);
  let changed = false;

  for (const occStart of occurrences) {
    const occEnd = occStart + text.length;
    if (occStart === skipStart) continue;

    const exactMask = findExactMask(occStart, occEnd, state);
    if (exactMask) {
      const tokenId = `${occStart}-${occEnd}`;
      if (state.unmaskedPositions.has(tokenId)) {
        state.unmaskedPositions.delete(tokenId);
        changed = true;
      }
      continue;
    }

    const overlapping = findOverlappingMasks(occStart, occEnd, state);
    for (const overlap of overlapping) {
      splitMaskAround({
        pos: overlap,
        holeStart: occStart,
        holeEnd: occEnd,
        state,
      });
    }
    state.manualMasks.push({ start: occStart, end: occEnd, original: text });
    changed = true;
  }

  return changed;
}

/**
 * テキストの全出現箇所のマスクを解除（表示）する。
 */
export function propagateUnmask(text: string, state: MaskState): void {
  for (const occStart of findAllOccurrences(state.originalText, text)) {
    const occEnd = occStart + text.length;
    if (findExactMask(occStart, occEnd, state)) {
      state.unmaskedPositions.add(`${occStart}-${occEnd}`);
    }
  }
}

/**
 * テキストの全出現箇所を再マスク（解除取り消し）する。
 */
export function propagateRemask(text: string, state: MaskState): void {
  for (const occStart of findAllOccurrences(state.originalText, text)) {
    state.unmaskedPositions.delete(`${occStart}-${occStart + text.length}`);
  }
}

/**
 * マスクが適用されたテキストを返す（クリップボードコピー用）。
 */
export function buildMaskedText(state: MaskState): string {
  return applyMasksToText(
    state.originalText,
    [...state.positions, ...state.manualMasks],
    state.unmaskedPositions
  );
}

/**
 * ドラッグ選択範囲にマスクを追加し、同一テキストの全出現箇所に伝播する。
 * 変更があった場合は true を返す。
 */
export function addManualMask(params: {
  start: number;
  end: number;
  state: MaskState;
}): boolean {
  const { start, end, state } = params;

  // ① 選択範囲と重複するアンマスク済みトークンを削除
  const unmaskedOverlap = findUnmaskedOverlapping(start, end, state);
  for (const pos of unmaskedOverlap) {
    removePositionByTokenId(`${pos.start}-${pos.end}`, state);
  }

  // ② 改行で分割して各セグメントをマスク追加
  const segments = splitSelectionByNewlines(state.originalText, start, end);
  let changed = unmaskedOverlap.length > 0;

  for (const segment of segments) {
    const allExistingMasks = [...state.positions, ...state.manualMasks];
    if (checkOverlapWithAny(segment, allExistingMasks)) continue;
    state.manualMasks.push(segment);
    changed = true;
    propagateMask({ text: segment.original, skipStart: segment.start, state });
  }

  return changed;
}
