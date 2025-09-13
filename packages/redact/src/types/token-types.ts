// Type definitions for tokens
export interface SudachiToken {
  surface: string;
  poses: string[];
  start: number;
  end: number;
}

export interface TokenContext {
  current: SudachiToken;
  before: SudachiToken[];
  after: SudachiToken[];
  index: number;
  allTokens: SudachiToken[];
}

export interface TokenSequence {
  text: string;
  start: number;
  end: number;
  tokens: SudachiToken[];
}

export interface TokenPattern {
  surfaces?: string[];
  poses?: string[][];
  surfaceRegex?: RegExp;
  positionRelative?: 'before' | 'after' | 'current';
  distance?: number;
}

export interface SequencePattern {
  patterns: TokenPattern[];
  name: string;
  description?: string;
}

export interface AdministrativeLevel {
  level: 'prefecture' | 'city' | 'district' | null;
  isAdministrative: boolean;
}

export interface PersonNameResult {
  isPersonName: boolean;
  type: 'surname' | 'given_name' | null;
}
