import { TokenizeMode, tokenize } from 'sudachi';
import { parseSudachiTokens } from './analyzers/token-parser.js';
import {
  runDetectionPipeline,
  type DetectedItem,
} from './analyzers/detection-pipeline.js';
import { filterOutIdentifierPatterns } from './analyzers/identifier-filter.js';
import type { SudachiToken } from './types/token-types.js';

export type { DetectedItem, SudachiToken };

export interface MorphologyResult {
  names: DetectedItem[];
  allTokens: SudachiToken[];
}

export function analyzeMorphology(text: string): MorphologyResult {
  try {
    const json = tokenize(text, TokenizeMode.C);
    const allTokens = parseSudachiTokens(json);
    const detectedItems = runDetectionPipeline({ text, allTokens });
    const names = filterOutIdentifierPatterns(detectedItems, text);
    return { names, allTokens };
  } catch {
    return { names: [], allTokens: [] };
  }
}
