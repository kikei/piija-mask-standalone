export interface MaskResult {
  masked: string;
  positions: Array<{ start: number; end: number; original: string }>;
}

export const MASK_TOKEN = '＊＊＊＊';

interface MatchProcessor {
  (
    match: RegExpExecArray,
    text: string
  ): Array<{ start: number; end: number; original: string }> | null;
}

function findAllMatches(
  text: string,
  regex: RegExp,
  processor?: MatchProcessor
): Array<{ start: number; end: number; original: string }> {
  const positions: Array<{ start: number; end: number; original: string }> = [];
  let match;

  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (processor) {
      const processed = processor(match, text);
      if (processed) {
        positions.push(...processed);
      }
    } else {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
      });
    }
  }

  return positions;
}

function applyMask(
  text: string,
  positions: Array<{ start: number; end: number; original: string }>
): string {
  let masked = text;

  for (let i = positions.length - 1; i >= 0; i--) {
    const pos = positions[i]!;
    masked = masked.slice(0, pos.start) + MASK_TOKEN + masked.slice(pos.end);
  }

  return masked;
}

function createEmailRegex(): RegExp {
  return /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
}

function createPhoneRegex(): RegExp {
  return /0\d{1,4}-?\d{1,4}-?\d{4}/g;
}

function createMaskResult(
  text: string,
  positions: Array<{ start: number; end: number; original: string }>
): MaskResult {
  const masked = applyMask(text, positions);
  return { masked, positions };
}

export function maskEmail(text: string): MaskResult {
  const emailRegex = createEmailRegex();
  const positions = findAllMatches(text, emailRegex);
  return createMaskResult(text, positions);
}

export function maskPhone(text: string): MaskResult {
  const phoneRegex = createPhoneRegex();
  const positions = findAllMatches(text, phoneRegex);
  return createMaskResult(text, positions);
}

function createPostalRegex(): RegExp {
  // Group 1: 〒prefix, Group 2: number after 〒
  // Group 3: standalone hyphenated postal code
  // Standalone: not preceded by \d- (excludes mid-phone like 045-[123-4567])
  //             not followed by -\d  (excludes 090-[1234]-5678)
  return /(〒\s*)(\d{3}-?\d{4})|(?<!\d-)\b(\d{3}-\d{4})(?!-\d)/g;
}

function processPostalMatch(
  match: RegExpExecArray
): Array<{ start: number; end: number; original: string }> {
  if (match[1] !== undefined) {
    // 〒付き: 数字部分のみマスク
    const numberPart = match[2]!;
    const numberStart = match.index + match[1].length;
    return [
      {
        start: numberStart,
        end: numberStart + numberPart.length,
        original: numberPart,
      },
    ];
  }
  // ハイフンあり単独
  const numberPart = match[3]!;
  return [
    {
      start: match.index,
      end: match.index + numberPart.length,
      original: numberPart,
    },
  ];
}

export function maskPostalCode(text: string): MaskResult {
  const postalRegex = createPostalRegex();
  const processor: MatchProcessor = match => processPostalMatch(match);
  const positions = findAllMatches(text, postalRegex, processor);
  return createMaskResult(text, positions);
}

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]!, 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

function createCreditCardRegex(): RegExp {
  return /\b[\d\s-]{13,19}\b/g;
}

function extractDigitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

function isValidCreditCardLength(digits: string): boolean {
  return digits.length >= 13 && digits.length <= 19;
}

function processCreditCardMatch(
  match: RegExpExecArray
): Array<{ start: number; end: number; original: string }> | null {
  const digits = extractDigitsOnly(match[0]);
  if (isValidCreditCardLength(digits) && luhnCheck(digits)) {
    return [
      {
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
      },
    ];
  }
  return null;
}

export function maskCreditCard(text: string): MaskResult {
  const cardRegex = createCreditCardRegex();
  const processor: MatchProcessor = match => processCreditCardMatch(match);
  const positions = findAllMatches(text, cardRegex, processor);
  return createMaskResult(text, positions);
}

function myNumberCheck(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  if (digits.length !== 12) return false;

  const weights = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i]!;
  }

  const checkDigit = 11 - (sum % 11);
  const expectedCheck = checkDigit >= 10 ? 0 : checkDigit;

  return parseInt(digits[11]!, 10) === expectedCheck;
}

function createMyNumberRegex(): RegExp {
  return /\b[\d\s-]{12,}\b/g;
}

function isValidMyNumberLength(digits: string): boolean {
  return digits.length === 12;
}

function processMyNumberMatch(
  match: RegExpExecArray
): Array<{ start: number; end: number; original: string }> | null {
  const digits = extractDigitsOnly(match[0]);
  if (isValidMyNumberLength(digits) && myNumberCheck(digits)) {
    return [
      {
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
      },
    ];
  }
  return null;
}

export function maskMyNumber(text: string): MaskResult {
  const myNumberRegex = createMyNumberRegex();
  const processor: MatchProcessor = match => processMyNumberMatch(match);
  const positions = findAllMatches(text, myNumberRegex, processor);
  return createMaskResult(text, positions);
}
