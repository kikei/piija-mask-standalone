import type { Position } from './position.js';
import type { RedactPosition } from './redact-browser.js';

export enum UIState {
  Initial = 'initial',
  InputReady = 'input-ready',
  Masked = 'masked',
}

export interface MaskState {
  originalText: string;
  positions: RedactPosition[];
  manualMasks: Position[];
  unmaskedPositions: Set<string>;
}

export function createInitialState(): MaskState {
  return {
    originalText: '',
    positions: [],
    manualMasks: [],
    unmaskedPositions: new Set(),
  };
}
