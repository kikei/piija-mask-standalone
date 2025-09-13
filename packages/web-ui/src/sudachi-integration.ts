// Sudachi 形態素解析統合モジュール
import { loadBrotliSudachi, tokenize } from './loaders/brotli-loader.js';
import {
  parseSudachiTokens,
  runDetectionPipeline,
  filterOutIdentifierPatterns,
  type DetectedItem,
  type SudachiToken,
} from '@redactjp/redact';

export type { SudachiToken } from '@redactjp/redact';

export interface NameDetectionResult {
  original: string;
  names: DetectedItem[];
  allTokens: SudachiToken[];
}

let sudachiReady = false;

export async function initSudachi(
  onProgress?: (ratio: number) => void
): Promise<boolean> {
  try {
    console.log('Loading: Initializing Sudachi morphological analyzer...');

    console.log('Info: Calling loadBrotliSudachi()...');
    const loadSuccess = await loadBrotliSudachi(onProgress);
    console.log(`Info: loadBrotliSudachi() result: ${loadSuccess}`);

    if (!loadSuccess) {
      console.error('Error: loadBrotliSudachi() failed');
      throw new Error('Sudachi module loading failed');
    }

    console.log('🧪 Starting Sudachi operation test...');
    const testJson = await tokenize('テスト');
    console.log(`🧪 tokenize result JSON: ${testJson.substring(0, 200)}...`);

    const testTokens = JSON.parse(testJson);
    console.log(`🧪 Parsed token count: ${testTokens ? testTokens.length : 0}`);

    if (testTokens && testTokens.length > 0) {
      console.log(`🧪 First token: ${JSON.stringify(testTokens[0])}`);
      sudachiReady = true;
      console.log(
        'Success: Sudachi morphological analyzer initialization complete'
      );
      return true;
    } else {
      throw new Error('Sudachi test failed: no tokens returned');
    }
  } catch (error) {
    console.error('Error: Sudachi initialization error:', error);
    console.error(
      'Error: Error stack:',
      error instanceof Error ? error.stack : 'No stack info'
    );
    sudachiReady = false;
    return false;
  }
}

export function isSudachiReady(): boolean {
  return sudachiReady;
}

export async function analyzeMorphology(
  text: string
): Promise<NameDetectionResult> {
  if (!sudachiReady) {
    console.warn('Warning: Sudachi not initialized');
    return { original: text, names: [], allTokens: [] };
  }

  try {
    const json = await tokenize(text);
    const allTokens = parseSudachiTokens(json);

    const detectedItems = runDetectionPipeline({ text, allTokens });

    console.log('Debug: Detection process details:');
    if (detectedItems.length > 0) {
      console.log(`Stats: Initial detection: ${detectedItems.length} items`);
      detectedItems.forEach((item, i) => {
        console.log(
          `  ${i + 1}. "${item.text}" (${item.type}) at ${item.start}-${item.end}`
        );
      });
    } else {
      console.log('Stats: Initial detection: 0 items');
    }

    const filteredNames = filterOutIdentifierPatterns(detectedItems, text);

    const excludedCount = detectedItems.length - filteredNames.length;
    if (excludedCount > 0) {
      console.log(`🚫 Filtered out: ${excludedCount} items`);
    }

    console.log(`Success: Final result: ${filteredNames.length} items`);

    return { original: text, names: filteredNames, allTokens };
  } catch (error) {
    console.error('Error: Sudachi analysis error:', error);
    return { original: text, names: [], allTokens: [] };
  }
}
