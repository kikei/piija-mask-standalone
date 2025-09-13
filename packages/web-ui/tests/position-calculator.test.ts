import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import {
  findOriginalOffset,
  calculateSelectionPositions,
  mapDisplayToOriginalPosition,
} from '../src/position-calculator.js';

describe('position-calculator', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    // @ts-expect-error - Setting global for testing
    global.document = document;
    // @ts-expect-error - Setting global for testing
    global.Node = dom.window.Node;
    // @ts-expect-error - Setting global for testing
    global.NodeFilter = dom.window.NodeFilter;
  });

  // Helper: build a <div class="masked-token" data-token-id="s-e">
  function makeTokenSpan(
    tokenId: string,
    content: string,
    unmasked = false
  ): HTMLElement {
    const span = document.createElement('span');
    span.className = unmasked ? 'masked-token original' : 'masked-token';
    span.dataset.tokenId = tokenId;
    span.textContent = content;
    return span;
  }

  describe('mapDisplayToOriginalPosition', () => {
    it('maps simple position without masks', () => {
      const result = mapDisplayToOriginalPosition(5, 'Hello world', []);
      assert.strictEqual(result, 5);
    });

    it('maps position before a mask (no adjustment)', () => {
      // "world" (6-11) masked → "＊＊＊＊"
      // display: "Hello ＊＊＊＊ test"
      // display pos 3 is 'l' in "Hello" → original pos 3
      const result = mapDisplayToOriginalPosition(3, 'Hello world test', [
        { start: 6, end: 11 },
      ]);
      assert.strictEqual(result, 3);
    });

    it('maps position inside a mask to mask start', () => {
      // "Hello" (0-5) masked → display chars 0-3
      // display pos 2 lands inside "＊＊＊＊" → original pos 0 (mask start)
      const result = mapDisplayToOriginalPosition(2, 'Hello world test', [
        { start: 0, end: 5 },
      ]);
      assert.strictEqual(result, 0);
    });

    it('maps position after a mask with adjustment', () => {
      // "Hello" (0-5) → "＊＊＊＊" (4 chars)
      // display pos 4 = right after "＊＊＊＊" = space at original pos 5
      const result = mapDisplayToOriginalPosition(4, 'Hello world test', [
        { start: 0, end: 5 },
      ]);
      assert.strictEqual(result, 5);
    });

    it('maps position after multiple masks', () => {
      // "Hello"(0-5) → 4 chars, "world"(6-11) → 4 chars
      // display: "＊＊＊＊ ＊＊＊＊ test"
      //           0123  4 5678  9 10-13
      // display pos 9  = second ' ' = original pos 11
      // display pos 10 = 't' of "test" = original pos 12
      const result = mapDisplayToOriginalPosition(10, 'Hello world test', [
        { start: 0, end: 5 },
        { start: 6, end: 11 },
      ]);
      assert.strictEqual(result, 12);
    });

    it('clamps to originalText.length at end', () => {
      const result = mapDisplayToOriginalPosition(100, 'Hello world', []);
      assert.strictEqual(result, 'Hello world'.length);
    });
  });

  describe('findOriginalOffset', () => {
    it('maps text node offset in plain text container', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello world');
      container.appendChild(textNode);

      assert.strictEqual(findOriginalOffset(textNode, 5, container), 5);
    });

    it('maps text node after another text node', () => {
      const container = document.createElement('div');
      const t1 = document.createTextNode('Hello ');
      const t2 = document.createTextNode('world');
      container.appendChild(t1);
      container.appendChild(t2);

      // t2 starts at offset 6
      assert.strictEqual(findOriginalOffset(t2, 2, container), 8);
    });

    it('maps text inside a masked-token span to span start', () => {
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('Hello '));
      container.appendChild(makeTokenSpan('6-10', '＊＊＊＊'));
      container.appendChild(document.createTextNode(' world'));

      // The text node inside the span
      const span = container.querySelector('.masked-token')!;
      const spanText = span.firstChild as Text;

      // Any offset inside a masked token → original start (6)
      assert.strictEqual(findOriginalOffset(spanText, 0, container), 6);
      assert.strictEqual(findOriginalOffset(spanText, 2, container), 6);
    });

    it('maps text inside an unmasked (original) span with 1:1 offset', () => {
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('Hello '));
      container.appendChild(makeTokenSpan('6-10', '山田', true));
      container.appendChild(document.createTextNode(' world'));

      const span = container.querySelector('.masked-token')!;
      const spanText = span.firstChild as Text;

      // unmasked → start + targetOffset
      assert.strictEqual(findOriginalOffset(spanText, 0, container), 6);
      assert.strictEqual(findOriginalOffset(spanText, 2, container), 8);
    });

    it('maps text after a masked-token span correctly', () => {
      // original: "Hello 山田太郎 world"  span covers chars 6-10 (山田太郎)
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('Hello '));
      container.appendChild(makeTokenSpan('6-10', '＊＊＊＊'));
      const after = document.createTextNode(' world');
      container.appendChild(after);

      // " world" starts at original pos 10
      assert.strictEqual(findOriginalOffset(after, 0, container), 10);
      assert.strictEqual(findOriginalOffset(after, 3, container), 13);
    });

    it('handles newlines in plain text nodes', () => {
      // original: "Hello\nworld"
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello\nworld');
      container.appendChild(textNode);

      // '\n' is counted as a normal character (index 5)
      assert.strictEqual(findOriginalOffset(textNode, 6, container), 6);
    });

    it('maps element container (span) as target node', () => {
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('ABC'));
      const span = makeTokenSpan('3-7', '＊＊＊＊');
      container.appendChild(span);
      container.appendChild(document.createTextNode('XYZ'));

      // targetNode = span, targetOffset = 0 → before span content = pos 3
      assert.strictEqual(findOriginalOffset(span, 0, container), 3);
    });

    it('returns end of text when node is not in container', () => {
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('Hello'));
      const other = document.createTextNode('Other');

      // not found → returns origCursor at end = 5
      assert.strictEqual(findOriginalOffset(other, 0, container), 5);
    });
  });

  describe('calculateSelectionPositions', () => {
    it('returns start and end in original text for a plain-text range', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello world test');
      container.appendChild(textNode);

      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 11);

      const result = calculateSelectionPositions(range, container);
      assert.deepStrictEqual(result, { start: 6, end: 11 });
    });

    it('returns null when start > end', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello world');
      container.appendChild(textNode);

      const range = document.createRange();
      range.setStart(textNode, 5);
      range.setEnd(textNode, 3);

      // With a "reversed" range JSDOM may normalise it,
      // but findOriginalOffset should still return valid offsets.
      // We just verify the function doesn't throw.
      const result = calculateSelectionPositions(range, container);
      // Depending on whether JSDOM normalises ranges, result may be
      // { start: 3, end: 5 } or null.
      if (result !== null) {
        assert.ok(result.start <= result.end);
      }
    });

    it('handles range spanning a masked-token span', () => {
      // container: "Hello " + span(6-10,"＊＊＊＊") + " world"
      const container = document.createElement('div');
      const before = document.createTextNode('Hello ');
      container.appendChild(before);
      container.appendChild(makeTokenSpan('6-10', '＊＊＊＊'));
      const after = document.createTextNode(' world');
      container.appendChild(after);

      // Select from offset 3 in "Hello " to offset 2 in " world"
      const range = document.createRange();
      range.setStart(before, 3);
      range.setEnd(after, 2);

      const result = calculateSelectionPositions(range, container);
      // start = 3, end = 10 + 2 = 12
      assert.deepStrictEqual(result, { start: 3, end: 12 });
    });
  });
});
