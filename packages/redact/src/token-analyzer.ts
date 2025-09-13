// 形態素解析トークンシーケンス解析ユーティリティ
import type {
  SudachiToken,
  TokenContext,
  TokenPattern,
  SequencePattern,
  TokenSequence,
} from './types/token-types.js';
import { findAddressBlocks } from './analyzers/address-block-detector.js';
import {
  findCompoundPlaceNames,
  isCompoundPlaceInAddressContext,
} from './analyzers/compound-place-detector.js';

export type {
  TokenContext,
  TokenPattern,
  SequencePattern,
} from './types/token-types.js';

export class TokenSequenceAnalyzer {
  private tokens: SudachiToken[];

  constructor(tokens: SudachiToken[]) {
    this.tokens = tokens;
  }

  /**
   * 指定位置のトークンコンテキストを取得
   */
  getContext(
    offset: number,
    length: number,
    contextSize: number = 5
  ): TokenContext | null {
    const currentToken = this.findTokenAt(offset);
    if (!currentToken) return null;

    const currentIndex = this.tokens.indexOf(currentToken);
    if (currentIndex === -1) return null;

    const before = this.tokens
      .slice(Math.max(0, currentIndex - contextSize), currentIndex)
      .reverse();
    const after = this.tokens.slice(
      currentIndex + 1,
      currentIndex + 1 + contextSize
    );

    return {
      current: currentToken,
      before,
      after,
      index: currentIndex,
      allTokens: this.tokens,
    };
  }

  /**
   * トークンがパターンに一致するかチェック
   */
  matchesPattern(token: SudachiToken, pattern: TokenPattern): boolean {
    if (pattern.surfaces && !pattern.surfaces.includes(token.surface)) {
      return false;
    }
    if (pattern.surfaceRegex && !pattern.surfaceRegex.test(token.surface)) {
      return false;
    }
    if (pattern.poses) {
      const matches = pattern.poses.some(posPattern =>
        posPattern.every(
          (pos, index) => pos === '*' || token.poses[index] === pos
        )
      );
      if (!matches) return false;
    }
    return true;
  }

  /**
   * シーケンスパターンを検索
   */
  findSequencePattern(pattern: SequencePattern): TokenContext[] {
    const matches: TokenContext[] = [];

    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (!token) continue;

      const context = this.getContext(token.start, token.end - token.start);
      if (!context) continue;

      if (this.matchesSequence(context, pattern)) {
        matches.push(context);
      }
    }

    return matches;
  }

  private matchesSequence(
    context: TokenContext,
    pattern: SequencePattern
  ): boolean {
    for (const tokenPattern of pattern.patterns) {
      if (!this.findPatternInContext(context, tokenPattern)) {
        return false;
      }
    }
    return true;
  }

  private findPatternInContext(
    context: TokenContext,
    pattern: TokenPattern
  ): boolean {
    const { positionRelative = 'current', distance = 5 } = pattern;

    let tokensToCheck: SudachiToken[];
    switch (positionRelative) {
      case 'before':
        tokensToCheck = context.before.slice(0, distance);
        break;
      case 'after':
        tokensToCheck = context.after.slice(0, distance);
        break;
      case 'current':
        tokensToCheck = [context.current];
        break;
    }

    return tokensToCheck.some(token => this.matchesPattern(token, pattern));
  }

  private findTokenAt(offset: number): SudachiToken | null {
    return (
      this.tokens.find(token => token.start <= offset && offset < token.end) ||
      null
    );
  }

  /**
   * 住所ブロック検出（address-block-detector に委譲）
   */
  findAddressBlocks(): TokenSequence[] {
    return findAddressBlocks(this.tokens);
  }

  /**
   * 複合地名検出（compound-place-detector に委譲）
   */
  findCompoundPlaceNames(): TokenSequence[] {
    return findCompoundPlaceNames(this.tokens);
  }

  /**
   * 複合地名が住所コンテキストにあるかチェック（compound-place-detector に委譲）
   */
  isCompoundPlaceInAddressContext(compound: TokenSequence): boolean {
    return isCompoundPlaceInAddressContext(compound, this.tokens);
  }
}

// よく使うパターン定義
export const CommonPatterns = {
  // 行政区分 → 地名 → 番地のシーケンス
  personalAddressSequence: {
    name: 'personal_address',
    description: '個人識別可能な住所シーケンス',
    patterns: [
      {
        positionRelative: 'before' as const,
        poses: [['名詞', '普通名詞', '*']],
        surfaces: ['市', '町', '村', '区'],
        distance: 3,
      },
      {
        positionRelative: 'current' as const,
        poses: [['名詞', '固有名詞', '地名']],
      },
      {
        positionRelative: 'after' as const,
        surfaceRegex: /^\d+(-\d+)*$/,
        distance: 3,
      },
    ],
  } as SequencePattern,

  // 施設名内の地名
  facilityPlaceName: {
    name: 'facility_place',
    description: '施設名に含まれる地名',
    patterns: [
      {
        positionRelative: 'current' as const,
        poses: [['名詞', '固有名詞', '地名']],
      },
      {
        positionRelative: 'after' as const,
        surfaces: [
          'ホテル',
          'リゾート',
          '温泉',
          '旅館',
          '病院',
          '学校',
          '大学',
        ],
        distance: 3,
      },
    ],
  } as SequencePattern,
};
