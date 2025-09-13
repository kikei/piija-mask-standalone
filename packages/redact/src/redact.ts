import { normalizeText } from './normalize.js';
import { analyzeMorphology } from './sudachi-node.js';
import {
  maskEmail,
  maskPhone,
  maskPostalCode,
  maskCreditCard,
  maskMyNumber,
} from './detectors.js';

export interface RedactOptions {
  skipNames?: boolean;
  skipAddresses?: boolean;
  skipEmails?: boolean;
  skipPhones?: boolean;
  skipPostalCodes?: boolean;
  skipCreditCards?: boolean;
  skipMyNumbers?: boolean;
}

export interface RedactResult {
  masked: string;
  positions: Array<{
    type: string;
    start: number;
    end: number;
    original: string;
  }>;
}

type Position = { type: string; start: number; end: number; original: string };

function collectMorphologyPositions(
  text: string,
  options: RedactOptions
): Position[] {
  const skipNames = options.skipNames ?? false;
  const skipAddresses = options.skipAddresses ?? false;
  if (skipNames && skipAddresses) return [];

  const { names } = analyzeMorphology(text);
  const positions: Position[] = [];

  for (const n of names) {
    const isPerson = n.type === 'surname' || n.type === 'given_name';
    if (isPerson && skipNames) continue;
    if (!isPerson && skipAddresses) continue;

    positions.push({
      type: isPerson ? 'name' : 'address',
      start: n.start,
      end: n.end,
      original: text.slice(n.start, n.end),
    });
  }

  return positions;
}

function collectRegexPositions(
  text: string,
  options: RedactOptions
): Position[] {
  const positions: Position[] = [];

  if (!options.skipEmails) {
    maskEmail(text).positions.forEach(p =>
      positions.push({ ...p, type: 'email' })
    );
  }
  if (!options.skipPhones) {
    maskPhone(text).positions.forEach(p =>
      positions.push({ ...p, type: 'phone' })
    );
  }
  if (!options.skipPostalCodes) {
    maskPostalCode(text).positions.forEach(p =>
      positions.push({ ...p, type: 'postal' })
    );
  }
  if (!options.skipCreditCards) {
    maskCreditCard(text).positions.forEach(p =>
      positions.push({ ...p, type: 'creditCard' })
    );
  }
  if (!options.skipMyNumbers) {
    maskMyNumber(text).positions.forEach(p =>
      positions.push({ ...p, type: 'myNumber' })
    );
  }

  return positions;
}

function applyMasks(text: string, positions: Position[]): string {
  const sorted = [...positions].sort((a, b) => b.start - a.start);
  let masked = text;
  for (const pos of sorted) {
    masked = masked.slice(0, pos.start) + '＊＊＊＊' + masked.slice(pos.end);
  }
  return masked;
}

export async function redact(
  text: string,
  options: RedactOptions = {}
): Promise<RedactResult> {
  const normalized = normalizeText(text);
  const positions = [
    ...collectMorphologyPositions(normalized, options),
    ...collectRegexPositions(normalized, options),
  ];
  const masked = applyMasks(normalized, positions);
  positions.sort((a, b) => a.start - b.start);
  return { masked, positions };
}
