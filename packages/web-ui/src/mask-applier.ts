import { type Position, sortPositionsForReplacement } from './position.js';

export function applyMasksToText(
  originalText: string,
  positions: Position[],
  unmaskedPositions: Set<string>
): string {
  const sortedPositions = sortPositionsForReplacement(positions);
  let text = originalText;

  for (const pos of sortedPositions) {
    const tokenId = `${pos.start}-${pos.end}`;
    if (!unmaskedPositions.has(tokenId)) {
      text = text.slice(0, pos.start) + '＊＊＊＊' + text.slice(pos.end);
    }
  }

  return text;
}

/**
 * Splits a selection [start, end) in originalText by newlines and
 * returns a Position for each non-empty line segment.
 * Newline characters are excluded from every mask so they remain
 * visible in the rendered output.
 */
export function splitSelectionByNewlines(
  originalText: string,
  start: number,
  end: number
): Position[] {
  const selected = originalText.slice(start, end);
  const result: Position[] = [];
  let cursor = start;

  for (const line of selected.split('\n')) {
    const segStart = cursor;
    const segEnd = cursor + line.length;
    cursor = segEnd + 1; // +1 to skip the '\n'

    if (line.trim().length === 0) continue; // nothing to mask

    result.push({ start: segStart, end: segEnd, original: line });
  }

  return result;
}

/**
 * Finds all non-overlapping occurrences of `needle` in `text`.
 * Returns an array of start indices in ascending order.
 */
export function findAllOccurrences(text: string, needle: string): number[] {
  if (needle.length === 0) return [];
  const result: number[] = [];
  let idx = 0;
  while (idx <= text.length - needle.length) {
    const found = text.indexOf(needle, idx);
    if (found === -1) break;
    result.push(found);
    idx = found + needle.length;
  }
  return result;
}
