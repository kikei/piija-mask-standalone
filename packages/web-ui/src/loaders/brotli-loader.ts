// Brotli-compressed Sudachi dictionary loader
import { streamDownload } from './download-utils.js';
import {
  initSudachiWorker,
  isSudachiLoaded,
} from './sudachi-utils.js';

let isLoading = false;
let isLoaded = false;

/**
 * Load and initialize Sudachi from the Brotli-compressed bundle.
 * Decompression and JS evaluation run in a Web Worker (off main thread).
 * @param onProgress called with ratio 0–1 as loading progresses
 */
export async function loadBrotliSudachi(
  onProgress?: (ratio: number) => void
): Promise<boolean> {
  if (isLoaded && isSudachiLoaded()) {
    return true;
  }

  if (isLoading) {
    await waitForLoad();
    return isLoaded;
  }

  try {
    isLoading = true;
    console.log('Loading: Downloading Brotli-compressed Sudachi dictionary...');

    // Download on main thread (keeps progress bar working)
    const compressedData = await downloadBrotliBundle(p =>
      onProgress?.(p * 0.7)
    );

    // Decompress + eval in Worker (non-blocking)
    // Worker signals decompressed (→ 90%) then ready (→ 100%)
    await initSudachiWorker(compressedData, onProgress);

    console.log(
      'Success: Brotli-compressed Sudachi dictionary loading complete'
    );
    isLoaded = true;
    return true;
  } catch (error) {
    console.error(
      'Error: Failed to load Brotli-compressed Sudachi dictionary:',
      error
    );

    return false;
  } finally {
    isLoading = false;
  }
}

/**
 * Stream-download the Brotli-compressed bundle with progress reporting.
 */
async function downloadBrotliBundle(
  onProgress?: (ratio: number) => void
): Promise<Uint8Array> {
  const controller = new AbortController();

  return await streamDownload({
    url: './sudachi-bundle.js.br',
    controller,
    onProgress: p => {
      if (p.totalLength) {
        onProgress?.(p.receivedLength / p.totalLength);
      }
    },
    minSpeedMBps: 0.5,
    speedCheckInterval: 10000,
  });
}

/**
 * Wait for a concurrent load to finish.
 */
async function waitForLoad(): Promise<void> {
  while (isLoading) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Re-exports
export { isSudachiLoaded, tokenize } from './sudachi-utils.js';
