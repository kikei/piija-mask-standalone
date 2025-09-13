import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  type Position,
  hasOverlap,
  checkOverlapWithAny,
  sortPositionsForDisplay,
  sortPositionsForReplacement,
} from '../src/position.js';
import {
  applyMasksToText,
  splitSelectionByNewlines,
  findAllOccurrences,
} from '../src/mask-applier.js';

describe('text-utils', () => {
  describe('hasOverlap', () => {
    it('should detect overlap when pos1 starts inside pos2', () => {
      const pos1: Position = { start: 5, end: 10, original: 'test' };
      const pos2: Position = { start: 3, end: 7, original: 'other' };
      assert.strictEqual(hasOverlap(pos1, pos2), true);
    });

    it('should detect overlap when pos1 ends inside pos2', () => {
      const pos1: Position = { start: 0, end: 5, original: 'test' };
      const pos2: Position = { start: 3, end: 8, original: 'other' };
      assert.strictEqual(hasOverlap(pos1, pos2), true);
    });

    it('should detect overlap when pos1 contains pos2', () => {
      const pos1: Position = { start: 0, end: 10, original: 'test' };
      const pos2: Position = { start: 3, end: 7, original: 'other' };
      assert.strictEqual(hasOverlap(pos1, pos2), true);
    });

    it('should not detect overlap when positions are separate', () => {
      const pos1: Position = { start: 0, end: 5, original: 'test' };
      const pos2: Position = { start: 10, end: 15, original: 'other' };
      assert.strictEqual(hasOverlap(pos1, pos2), false);
    });

    it('should not detect overlap when positions are adjacent', () => {
      const pos1: Position = { start: 0, end: 5, original: 'test' };
      const pos2: Position = { start: 5, end: 10, original: 'other' };
      assert.strictEqual(hasOverlap(pos1, pos2), false);
    });
  });

  describe('checkOverlapWithAny', () => {
    it('should detect overlap with any position in array', () => {
      const newPos: Position = { start: 3, end: 7, original: 'new' };
      const existing: Position[] = [
        { start: 0, end: 2, original: 'first' },
        { start: 5, end: 10, original: 'second' },
        { start: 15, end: 20, original: 'third' },
      ];
      assert.strictEqual(checkOverlapWithAny(newPos, existing), true);
    });

    it('should return false when no overlap exists', () => {
      const newPos: Position = { start: 11, end: 14, original: 'new' };
      const existing: Position[] = [
        { start: 0, end: 5, original: 'first' },
        { start: 8, end: 10, original: 'second' },
        { start: 15, end: 20, original: 'third' },
      ];
      assert.strictEqual(checkOverlapWithAny(newPos, existing), false);
    });
  });

  describe('sortPositionsForDisplay', () => {
    it('should sort positions by start index ascending', () => {
      const positions: Position[] = [
        { start: 10, end: 15, original: 'third' },
        { start: 0, end: 5, original: 'first' },
        { start: 5, end: 10, original: 'second' },
      ];
      const sorted = sortPositionsForDisplay(positions);
      assert.strictEqual(sorted[0].original, 'first');
      assert.strictEqual(sorted[1].original, 'second');
      assert.strictEqual(sorted[2].original, 'third');
    });
  });

  describe('sortPositionsForReplacement', () => {
    it('should sort positions by start index descending', () => {
      const positions: Position[] = [
        { start: 0, end: 5, original: 'first' },
        { start: 10, end: 15, original: 'third' },
        { start: 5, end: 10, original: 'second' },
      ];
      const sorted = sortPositionsForReplacement(positions);
      assert.strictEqual(sorted[0].original, 'third');
      assert.strictEqual(sorted[1].original, 'second');
      assert.strictEqual(sorted[2].original, 'first');
    });
  });

  describe('splitSelectionByNewlines', () => {
    it('returns a single segment when there are no newlines', () => {
      const result = splitSelectionByNewlines('Hello world', 0, 11);
      assert.deepStrictEqual(result, [
        { start: 0, end: 11, original: 'Hello world' },
      ]);
    });

    it('splits on newline into two segments', () => {
      // originalText: "Hello\nworld", select all
      const result = splitSelectionByNewlines('Hello\nworld', 0, 11);
      assert.deepStrictEqual(result, [
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ]);
    });

    it('skips empty segments from consecutive newlines', () => {
      // select "\n\n" → two empty segments → nothing
      const result = splitSelectionByNewlines('a\n\nb', 1, 3);
      assert.deepStrictEqual(result, []);
    });

    it('handles selection in the middle of the text', () => {
      // originalText: "abc\ndef\nghi", select "def\nghi" (4..11)
      const result = splitSelectionByNewlines('abc\ndef\nghi', 4, 11);
      assert.deepStrictEqual(result, [
        { start: 4, end: 7, original: 'def' },
        { start: 8, end: 11, original: 'ghi' },
      ]);
    });

    it('skips whitespace-only segments', () => {
      // "Hello\n   \nworld" — the middle line is spaces only, not masked
      const result = splitSelectionByNewlines('Hello\n   \nworld', 0, 15);
      assert.deepStrictEqual(result, [
        { start: 0, end: 5, original: 'Hello' },
        { start: 10, end: 15, original: 'world' },
      ]);
    });

    it('returns empty array when selecting only a newline', () => {
      const result = splitSelectionByNewlines('Hello\nworld', 5, 6);
      assert.deepStrictEqual(result, []);
    });

    it('returns empty array for whitespace-only selection (no newline)', () => {
      const result = splitSelectionByNewlines('Hello   world', 5, 8);
      assert.deepStrictEqual(result, []);
    });

    it('handles three lines', () => {
      const text = 'a\nb\nc';
      const result = splitSelectionByNewlines(text, 0, 5);
      assert.deepStrictEqual(result, [
        { start: 0, end: 1, original: 'a' },
        { start: 2, end: 3, original: 'b' },
        { start: 4, end: 5, original: 'c' },
      ]);
    });
  });

  describe('findAllOccurrences', () => {
    it('returns empty array for empty needle', () => {
      assert.deepStrictEqual(findAllOccurrences('hello world', ''), []);
    });

    it('returns empty array when needle is not found', () => {
      assert.deepStrictEqual(findAllOccurrences('hello world', 'xyz'), []);
    });

    it('returns single index for one occurrence', () => {
      assert.deepStrictEqual(findAllOccurrences('hello world', 'world'), [6]);
    });

    it('returns multiple indices for non-overlapping occurrences', () => {
      assert.deepStrictEqual(findAllOccurrences('abcabc', 'abc'), [0, 3]);
    });

    it('skips overlapping matches (non-overlapping search)', () => {
      // "aa" in "aaaa": non-overlapping finds [0, 2]
      assert.deepStrictEqual(findAllOccurrences('aaaa', 'aa'), [0, 2]);
    });

    it('handles occurrence at start and end', () => {
      assert.deepStrictEqual(findAllOccurrences('Hi there Hi', 'Hi'), [0, 9]);
    });

    it('returns empty array for empty text', () => {
      assert.deepStrictEqual(findAllOccurrences('', 'abc'), []);
    });
  });

  describe('applyMasksToText', () => {
    it('should apply masks to text in correct order', () => {
      const originalText = 'Hello world test';
      const positions: Position[] = [
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ];
      const unmasked = new Set<string>();

      const result = applyMasksToText(originalText, positions, unmasked);
      assert.strictEqual(result, '＊＊＊＊ ＊＊＊＊ test');
    });

    it('should preserve unmasked positions', () => {
      const originalText = 'Hello world test';
      const positions: Position[] = [
        { start: 0, end: 5, original: 'Hello' },
        { start: 6, end: 11, original: 'world' },
      ];
      const unmasked = new Set(['0-5']);

      const result = applyMasksToText(originalText, positions, unmasked);
      assert.strictEqual(result, 'Hello ＊＊＊＊ test');
    });

    it('should handle line breaks correctly', () => {
      const originalText = 'Hello\nworld';
      const positions: Position[] = [{ start: 6, end: 11, original: 'world' }];
      const unmasked = new Set<string>();

      const result = applyMasksToText(originalText, positions, unmasked);
      assert.strictEqual(result, 'Hello\n＊＊＊＊');
    });
  });
});
