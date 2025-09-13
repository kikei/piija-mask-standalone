import type { Position } from './position.js';
import { sortPositionsForDisplay } from './position.js';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderMaskedDisplay(
  originalText: string,
  positions: Position[],
  unmaskedPositions: Set<string>
): string {
  let html = '';
  let lastIndex = 0;

  // Sort positions by start index for display.
  // Skip positions that start before lastIndex (overlapping / nested).
  const sortedPositions = sortPositionsForDisplay(positions);

  for (const pos of sortedPositions) {
    if (pos.start < lastIndex) continue; // skip nested / overlapping

    // Keep '\n' as literal newline — .text-display uses
    // white-space: pre-wrap so it renders as a line break.
    html += escapeHtml(originalText.slice(lastIndex, pos.start));

    const tokenId = `${pos.start}-${pos.end}`;
    const isUnmasked = unmaskedPositions.has(tokenId);
    const className = isUnmasked ? 'masked-token original' : 'masked-token';
    const content = isUnmasked ? pos.original : '＊＊＊＊';

    html += `<span class="${className}" data-token-id="${tokenId}">${escapeHtml(content)}</span>`;

    lastIndex = pos.end;
  }

  // Add remaining text
  html += escapeHtml(originalText.slice(lastIndex));

  return html;
}

export function renderOriginalDisplay(originalText: string): string {
  return escapeHtml(originalText);
}
