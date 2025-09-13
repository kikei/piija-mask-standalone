// トークン分類器
import type {
  SudachiToken,
  AdministrativeLevel,
  PersonNameResult,
} from '../types/token-types.js';

/**
 * 数字トークンかチェック
 */
export function isNumericToken(token: SudachiToken): boolean {
  return (
    token.poses.length >= 2 &&
    token.poses[0] === '名詞' &&
    token.poses[1] === '数詞'
  );
}

/**
 * 記号トークンかチェック（住所用）
 */
export function isAddressSymbolToken(token: SudachiToken): boolean {
  return (
    token.poses.length >= 2 &&
    token.poses[0] === '補助記号' &&
    (token.surface === '-' || token.surface === '－' || token.surface === '—')
  );
}

/**
 * 地名検出（品詞ベース）
 */
export function isPlaceName(token: SudachiToken): boolean {
  return (
    token.poses.length >= 3 &&
    token.poses[0] === '名詞' &&
    token.poses[1] === '固有名詞' &&
    token.poses[2] === '地名'
  );
}

/**
 * 人名検出（品詞ベース）
 */
export function isPersonName(token: SudachiToken): PersonNameResult {
  const isName =
    token.poses.length >= 3 &&
    token.poses[0] === '名詞' &&
    token.poses[1] === '固有名詞' &&
    token.poses[2] === '人名';

  if (!isName) {
    return { isPersonName: false, type: null };
  }

  const type =
    token.poses.length >= 4 && token.poses[3] === '名'
      ? 'given_name'
      : 'surname';

  return { isPersonName: true, type };
}

/**
 * 行政区分レベルチェック
 */
export function getAdministrativeLevel(
  token: SudachiToken
): AdministrativeLevel {
  const prefectureSuffixes = ['県', '府', '都', '道'];
  // 町・村は自治体名と丁目名が区別できないため除外し、
  // isPersonalIdentifyingAddress 側でコンテキスト判定する
  const citySuffixes = ['市', '区'];
  const districtSuffixes = ['地区', '郡'];

  if (prefectureSuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'prefecture', isAdministrative: true };
  }

  if (citySuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'city', isAdministrative: true };
  }

  if (districtSuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'district', isAdministrative: true };
  }

  return { level: null, isAdministrative: false };
}

/**
 * 住所ブロック検出用：町・村も行政区分として扱う
 */
export function getAdministrativeLevelFull(
  token: SudachiToken
): AdministrativeLevel {
  const prefectureSuffixes = ['県', '府', '都', '道'];
  const citySuffixes = ['市', '町', '村', '区'];
  const districtSuffixes = ['地区', '郡'];

  if (prefectureSuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'prefecture', isAdministrative: true };
  }

  if (citySuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'city', isAdministrative: true };
  }

  if (districtSuffixes.some(suffix => token.surface.endsWith(suffix))) {
    return { level: 'district', isAdministrative: true };
  }

  return { level: null, isAdministrative: false };
}

/**
 * 半角カタカナ人名候補チェック
 */
export function isHalfWidthKatakanaName(surface: string): boolean {
  const halfKatakanaRegex = /^[ｦ-ﾟ]+$/;
  return halfKatakanaRegex.test(surface) && surface.length >= 2;
}
