// Browser-compatible version of redact functionality
// Note: This version doesn't include Japanese name detection (kuromoji) for browser compatibility

import { PHONE_REGEX, maskPostalCode } from '@redactjp/redact';

export interface RedactPosition {
  start: number;
  end: number;
  type: string;
  original: string;
}

export interface RedactResult {
  original: string;
  masked: string;
  positions: RedactPosition[];
}

export interface RedactOptions {
  maskEmails?: boolean;
  maskPhones?: boolean;
  maskPostalCodes?: boolean;
  maskCreditCards?: boolean;
  maskMyNumbers?: boolean;
  maskNames?: boolean; // Will be ignored in browser version
}

// Email detection
function maskEmails(text: string): RedactPosition[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const positions: RedactPosition[] = [];
  let match;

  while ((match = emailRegex.exec(text)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'email',
      original: match[0],
    });
  }

  return positions;
}

// Phone detection
function maskPhones(text: string): RedactPosition[] {
  const regex = new RegExp(PHONE_REGEX.source, 'g');
  const positions: RedactPosition[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'phone',
      original: match[0],
    });
  }

  return positions;
}

// Credit card detection with Luhn algorithm
function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i]!;
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

function maskCreditCards(text: string): RedactPosition[] {
  const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  const positions: RedactPosition[] = [];
  let match;

  while ((match = ccRegex.exec(text)) !== null) {
    const cardNumber = match[0].replace(/[\s\-]/g, '');
    if (cardNumber.length === 16 && luhnCheck(cardNumber)) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'creditCard',
        original: match[0],
      });
    }
  }

  return positions;
}

// My Number detection
function myNumberCheck(myNumber: string): boolean {
  const digits = myNumber.split('').map(Number);
  if (digits.length !== 12) return false;

  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += digits[i]! * weights[i]!;
  }

  const remainder = sum % 11;
  const checkDigit = remainder <= 1 ? 0 : 11 - remainder;

  return checkDigit === digits[11]!;
}

function maskMyNumbers(text: string): RedactPosition[] {
  const myNumberRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  const positions: RedactPosition[] = [];
  let match;

  while ((match = myNumberRegex.exec(text)) !== null) {
    const myNumber = match[0].replace(/[\s\-]/g, '');
    if (myNumber.length === 12 && myNumberCheck(myNumber)) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'myNumber',
        original: match[0],
      });
    }
  }

  return positions;
}

// Main redact function
export async function redact(
  text: string,
  options: RedactOptions = {}
): Promise<RedactResult> {
  const {
    maskEmails: shouldMaskEmails = true,
    maskPhones: shouldMaskPhones = true,
    maskPostalCodes: shouldMaskPostalCodes = true,
    maskCreditCards: shouldMaskCreditCards = true,
    maskMyNumbers: shouldMaskMyNumbers = true,
  } = options;

  const positions: RedactPosition[] = [];

  if (shouldMaskEmails) {
    positions.push(...maskEmails(text));
  }

  if (shouldMaskPhones) {
    positions.push(...maskPhones(text));
  }

  if (shouldMaskPostalCodes) {
    maskPostalCode(text).positions.forEach(p =>
      positions.push({ ...p, type: 'postalCode' })
    );
  }

  if (shouldMaskCreditCards) {
    positions.push(...maskCreditCards(text));
  }

  if (shouldMaskMyNumbers) {
    positions.push(...maskMyNumbers(text));
  }

  // Sort positions by start index (reverse for replacement)
  positions.sort((a, b) => b.start - a.start);

  let maskedText = text;
  for (const pos of positions) {
    maskedText =
      maskedText.slice(0, pos.start) + '＊＊＊＊' + maskedText.slice(pos.end);
  }

  // Sort positions by start index for result
  positions.sort((a, b) => a.start - b.start);

  return {
    original: text,
    masked: maskedText,
    positions,
  };
}

// Name detector initialization - now handled by Sudachi integration
export async function initializeNameDetector(): Promise<void> {
  // Name detection is now available through Sudachi integration
  // This function is kept for compatibility with existing code
}
