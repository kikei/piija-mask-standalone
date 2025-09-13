// 人名シーケンス検出器（姓+名のパターン検出）
import type { SudachiToken, TokenSequence } from '../types/token-types.js';
import { getTokenContext } from './context-analyzer.js';

/**
 * 人名シーケンスの検出（姓+名のパターン）
 */
export function findNameSequences(tokens: SudachiToken[]): TokenSequence[] {
  const sequences: TokenSequence[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || processedIndices.has(i)) continue;

    // 姓として認識されたトークンを探す
    if (isSurnameToken(token)) {
      const sequence = extractNameSequence(tokens, i);
      if (sequence && isValidNameSequence(tokens, sequence)) {
        sequences.push(sequence);
        // 使用したトークンインデックスをマーク
        for (let j = i; j < i + sequence.tokens.length; j++) {
          processedIndices.add(j);
        }
      }
    }
  }

  return sequences;
}

/**
 * 姓トークンかどうかを判定
 */
function isSurnameToken(token: SudachiToken): boolean {
  return (
    token.poses.length >= 4 &&
    token.poses[0] === '名詞' &&
    token.poses[1] === '固有名詞' &&
    token.poses[2] === '人名' &&
    token.poses[3] === '姓'
  );
}

/**
 * 名前として認識されるべきトークンかどうかを判定
 */
function isGivenNameToken(token: SudachiToken): boolean {
  // 既に名前として認識されているもの
  if (
    token.poses.length >= 4 &&
    token.poses[0] === '名詞' &&
    token.poses[1] === '固有名詞' &&
    token.poses[2] === '人名' &&
    token.poses[3] === '名'
  ) {
    return true;
  }

  // 人名として使われる可能性の高いパターン
  return isPotentialGivenName(token);
}

/**
 * 人名として使われる可能性の高いトークンかどうかを判定
 */
function isPotentialGivenName(token: SudachiToken): boolean {
  const surface = token.surface.trim();

  // 空白や記号のみは除外
  if (!surface || /^[\s\-ー－—]+$/.test(surface)) {
    return false;
  }

  // 一文字の場合
  if (surface.length === 1) {
    // ひらがな・カタカナ・漢字の場合は人名の可能性
    if (/[あ-んア-ンー一-龯]/.test(surface)) {
      // 接頭辞として分類されていても、人名で使われる文字は受け入れる
      const nameCharacters = [
        '貴',
        '美',
        '愛',
        '恵',
        '香',
        '優',
        '真',
        '智',
        '綾',
        '麻',
      ];
      if (nameCharacters.includes(surface)) {
        return true;
      }
      return true; // 基本的に漢字1文字は人名として扱う
    }
  }

  // 複数文字の場合
  if (surface.length <= 4) {
    // ひらがな・カタカナ・漢字で構成される場合
    const isJapaneseChars = /^[あ-んア-ンー一-龯]+$/.test(surface);
    if (isJapaneseChars) {
      // 明らかに人名でない語を除外
      const nonNameWords = [
        '以上',
        '以下',
        '以外',
        '以内',
        '以来',
        '以前',
        '以後',
        '方法',
        '場合',
        '時間',
        '問題',
        '結果',
        '状況',
        '今回',
        '今日',
        '明日',
        '昨日',
        '先日',
        '都道府県',
        '市町村',
        '番地',
        '丁目',
      ];

      // 人名でよく使われる漢字の組み合わせ
      const commonNamePatterns = [
        /^[麻]/, // 麻で始まる名前（麻以、麻美など）
        /^[貴]/, // 貴で始まる名前（貴啓、貴子など）
        /^[美]/, // 美で始まる名前
        /^[愛]/, // 愛で始まる名前
        /[子|美|香|恵|代|江]$/, // 女性名によくある語尾
        /[郎|男|雄|夫|人|太|介|助]$/, // 男性名によくある語尾
      ];

      const hasNamePattern = commonNamePatterns.some(pattern =>
        pattern.test(surface)
      );
      const isNonNameWord = nonNameWords.includes(surface);

      return !isNonNameWord && (hasNamePattern || surface.length <= 2);
    }
  }

  return false;
}

/**
 * 敬称の接尾辞かどうかを判定（接尾辞品詞限定）
 */
function isHonorificSuffix(token: SudachiToken): boolean {
  if (token.poses[0] !== '接尾辞') return false;
  const honorifics = ['さん', '様', 'さま', 'くん', '君', 'ちゃん', '氏', '殿'];
  return honorifics.includes(token.surface);
}

/**
 * 姓単体でも人名と確定できる後続トークンかどうかを判定
 * （敬称・テキスト末尾・行末・句読点）
 */
function isNameTerminator(token: SudachiToken | undefined): boolean {
  if (!token) return true;
  if (isHonorificSuffix(token)) return true;
  const pos0 = token.poses[0] ?? '';
  return pos0 === '空白' || pos0 === '補助記号';
}

/**
 * 明らかに人名でないトークンかどうかを判定
 */
function isDefinitelyNotName(token: SudachiToken): boolean {
  const surface = token.surface.trim();

  // 補助記号・記号・助詞・助動詞などは名前に含まれない
  const notNamePos0 = [
    '補助記号',
    '記号',
    '助詞',
    '助動詞',
    '接続詞',
    '感動詞',
    '空白',
    '接尾辞',
  ];
  if (notNamePos0.includes(token.poses[0] ?? '')) {
    return true;
  }

  // 数字や記号
  if (/^[\d\-\s\.]+$/.test(surface)) {
    return true;
  }

  // 明らかに人名でない語
  const definitelyNotNames = [
    '県',
    '市',
    '町',
    '村',
    '区',
    '番地',
    '号',
    '丁目',
    'さん',
    'くん',
    'ちゃん',
    '様',
    '氏',
    'です',
    'ます',
    'である',
    'だった',
    'こと',
    'もの',
    'とき',
    'ところ',
  ];

  return definitelyNotNames.some(notName => surface.includes(notName));
}

/**
 * 人名シーケンスを抽出（姓から始まる連続する名前っぽいトークン）
 */
function extractNameSequence(
  tokens: SudachiToken[],
  startIndex: number
): TokenSequence | null {
  const sequenceTokens: SudachiToken[] = [];
  let currentIndex = startIndex;
  let text = '';

  // 最初の姓トークンを追加
  const firstToken = tokens[currentIndex];
  if (!firstToken) return null;

  sequenceTokens.push(firstToken);
  text += firstToken.surface;
  currentIndex++;

  // 次のトークンをチェック（空白、名前、人名として使える文字）
  let consecutiveNonNameTokens = 0;
  while (currentIndex < tokens.length) {
    const token = tokens[currentIndex];
    if (!token) break;

    // 新しい姓が見つかった場合は現在のシーケンスを終了
    if (isSurnameToken(token)) {
      break;
    }

    // 空白は飛ばして次をチェック（ただし改行文字を含む場合は終了）
    if (token.surface.trim() === '') {
      // 改行文字を含む場合は人名シーケンスを終了
      if (token.surface.includes('\n') || token.surface.includes('\r')) {
        break;
      }
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
      consecutiveNonNameTokens = 0; // 空白はカウントしない
      continue;
    }

    // 明らかに人名でないトークンは先にチェックして終了
    if (isDefinitelyNotName(token)) {
      break;
    }

    // 名前として認識できるトークンかチェック
    if (isGivenNameToken(token) || isPotentialGivenName(token)) {
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
      consecutiveNonNameTokens = 0;
    } else {
      consecutiveNonNameTokens++;
      // 連続して名前でないトークンが2個以上続いたら終了
      if (consecutiveNonNameTokens >= 2) {
        break;
      }
      sequenceTokens.push(token);
      text += token.surface;
      currentIndex++;
    }
  }

  const lastToken = sequenceTokens[sequenceTokens.length - 1];
  if (
    lastToken &&
    (sequenceTokens.length > 1 || isNameTerminator(tokens[currentIndex]))
  ) {
    return {
      text: text.trim(),
      start: firstToken.start,
      end: lastToken.end,
      tokens: sequenceTokens,
    };
  }

  return null;
}

/**
 * 有効な人名シーケンスかどうかを判定
 */
function isValidNameSequence(
  tokens: SudachiToken[],
  sequence: TokenSequence
): boolean {
  // 長すぎる場合は除外（通常の人名は10文字以内）
  if (sequence.text.replace(/\s/g, '').length > 10) {
    return false;
  }

  // 姓が含まれていることを確認（最低1つの姓が必要）
  const surnameCount = sequence.tokens.filter(token =>
    isSurnameToken(token)
  ).length;
  if (surnameCount === 0) {
    return false;
  }

  // コンテキストをチェック
  const context = getTokenContext(
    tokens,
    sequence.start,
    sequence.end - sequence.start
  );
  if (!context) return true;

  // 明らかに人名でないコンテキストを除外
  const invalidContexts = ['県', '市', '町', '村', '区', '番地', '号', '丁目'];
  const hasInvalidContext = [...context.before, ...context.after].some(token =>
    invalidContexts.some(invalid => token.surface.includes(invalid))
  );

  return !hasInvalidContext;
}
