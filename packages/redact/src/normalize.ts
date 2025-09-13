function normalizeUnicode(text: string): string {
  return text.normalize('NFKC');
}

function normalizeHyphens(text: string): string {
  const hyphens = /[‐\-–—−ー]/g;
  return text.replace(hyphens, '-');
}

function removeZeroWidthChars(text: string): string {
  const zeroWidthChars = /[\u200B-\u200D\uFEFF]/g;
  return text.replace(zeroWidthChars, '');
}

function removeControlChars(text: string): string {
  const controlChars = /[\x00-\x1F\x7F-\x9F]/g;
  return text.replace(controlChars, '');
}

function normalizeSpaces(text: string): string {
  const multipleSpaces = /\s+/g;
  return text.replace(multipleSpaces, ' ');
}

export function normalizeText(text: string): string {
  return [
    normalizeUnicode,
    normalizeHyphens,
    removeZeroWidthChars,
    removeControlChars,
    normalizeSpaces,
  ].reduce((result, fn) => fn(result), text);
}
