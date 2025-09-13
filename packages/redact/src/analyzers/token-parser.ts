import type { SudachiToken } from '../types/token-types.js';

/**
 * Sudachi JSON レスポンスをトークン配列に変換
 */
export function parseSudachiTokens(json: string): SudachiToken[] {
  const raw: Array<{ surface: string; poses: string[] }> = JSON.parse(json);
  let offset = 0;
  return raw.map(t => {
    const token: SudachiToken = {
      surface: t.surface,
      poses: t.poses,
      start: offset,
      end: offset + t.surface.length,
    };
    offset += t.surface.length;
    return token;
  });
}
