// Position calculation utilities for DOM selection

/**
 * Cross-browser helper: returns the text node and character offset
 * at the given screen coordinates.
 *
 * Uses document.caretPositionFromPoint (W3C standard, Chrome 128+,
 * Firefox 20+) with fallback to caretRangeFromPoint (Safari / older
 * Chrome).
 */
export function getCaretPositionFromPoint(
  x: number,
  y: number
): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === 'function') {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    return { node: pos.offsetNode, offset: pos.offset };
  }
  // Fallback for Safari / older Chrome
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range) return null;
    return {
      node: range.startContainer,
      offset: range.startOffset,
    };
  }
  return null;
}

/**
 * Parses a token ID of the form "start-end" and returns [start, end].
 * Uses lastIndexOf to handle multi-digit numbers correctly.
 */
function parseTokenId(tokenId: string): [number, number] {
  const dash = tokenId.lastIndexOf('-');
  if (dash < 0) return [0, 0];
  const start = parseInt(tokenId.slice(0, dash), 10);
  const end = parseInt(tokenId.slice(dash + 1), 10);
  return [isNaN(start) ? 0 : start, isNaN(end) ? 0 : end];
}

/**
 * Maps a DOM position (targetNode + targetOffset) within maskedDisplay
 * to the corresponding character offset in the original text.
 *
 * maskedDisplay DOM structure:
 * - Regular text nodes: characters map 1:1 to the original text.
 *   '\n' is stored as a literal newline (no <br> elements), because
 *   .text-display uses white-space: pre-wrap.
 * - <span class="masked-token" data-token-id="s-e">:
 *     maps to original[s..e).
 *     - Shows "＊＊＊＊" when masked.
 *     - Also has class "original" and shows the original text when
 *       unmasked. In that case, targetOffset maps 1:1 inside [s..e).
 */
export function findOriginalOffset(
  targetNode: Node,
  targetOffset: number,
  maskedDisplay: Element
): number {
  let origCursor = 0;
  let result: number | null = null;

  function visit(node: Node): void {
    if (result !== null) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const parentEl = node.parentElement;
      const maskedEl = parentEl?.classList.contains('masked-token')
        ? (parentEl as HTMLElement)
        : null;

      if (node === targetNode) {
        if (maskedEl) {
          const [start] = parseTokenId(maskedEl.dataset.tokenId ?? '');
          const isUnmasked = maskedEl.classList.contains('original');
          result = isUnmasked ? start + targetOffset : start;
        } else {
          result = origCursor + targetOffset;
        }
        return;
      }

      // Advance past this text node
      if (maskedEl) {
        const [, end] = parseTokenId(maskedEl.dataset.tokenId ?? '');
        origCursor = end;
      } else {
        origCursor += node.textContent?.length ?? 0;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node === targetNode) {
        // targetOffset = number of child nodes before the caret
        const children = Array.from(node.childNodes);
        for (let i = 0; i < children.length; i++) {
          if (i === targetOffset) {
            result = origCursor;
            return;
          }
          visit(children[i]!);
          if (result !== null) return;
        }
        result = origCursor;
        return;
      }

      // Recurse into this element's children
      for (const child of Array.from(node.childNodes)) {
        visit(child);
        if (result !== null) return;
      }
    }
  }

  for (const child of Array.from(maskedDisplay.childNodes)) {
    visit(child);
    if (result !== null) break;
  }

  return result ?? origCursor;
}

/**
 * Calculates start and end positions in the original text from a DOM
 * Range within the maskedDisplay element.
 * Returns null if positions are invalid.
 */
export function calculateSelectionPositions(
  range: Range,
  maskedDisplay: Element
): { start: number; end: number } | null {
  const start = findOriginalOffset(
    range.startContainer,
    range.startOffset,
    maskedDisplay
  );
  const end = findOriginalOffset(
    range.endContainer,
    range.endOffset,
    maskedDisplay
  );

  if (start > end) return null;
  return { start, end };
}

/**
 * Converts a display-coordinate offset to an original-text offset,
 * accounting for masked tokens that appear as 4 characters ("＊＊＊＊")
 * in the display but have a different length in the original text.
 *
 * This is correct only when the display was built without <br>
 * elements (i.e., newlines are kept as '\n' in text nodes).
 */
export function mapDisplayToOriginalPosition(
  displayPosition: number,
  originalText: string,
  maskedPositions: Array<{ start: number; end: number }>
): number {
  const DISPLAY_MASK_LEN = 4; // length of "＊＊＊＊"
  const sortedMasks = [...maskedPositions].sort((a, b) => a.start - b.start);

  let origCursor = 0;
  let dispCursor = 0;

  for (const mask of sortedMasks) {
    const segmentLen = mask.start - origCursor;

    if (displayPosition < dispCursor + segmentLen) {
      // Position lands in the plain-text segment before this mask
      return origCursor + (displayPosition - dispCursor);
    }
    dispCursor += segmentLen;
    origCursor = mask.start;

    if (displayPosition < dispCursor + DISPLAY_MASK_LEN) {
      // Position lands inside the mask display — map to mask start
      return mask.start;
    }
    dispCursor += DISPLAY_MASK_LEN;
    origCursor = mask.end;
  }

  // Position is after all masks
  const remaining = displayPosition - dispCursor;
  return Math.min(origCursor + remaining, originalText.length);
}
