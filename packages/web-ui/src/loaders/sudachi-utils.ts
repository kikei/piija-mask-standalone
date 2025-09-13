// Sudachi initialization and tokenization utility functions

type WorkerOutMessage =
  | { type: 'decompressed' }
  | { type: 'ready' }
  | { type: 'tokenized'; json: string }
  | { type: 'error'; message: string };

type SudachiBridge = {
  tokenize: (text: string, mode: unknown) => string;
  TokenizeMode: { C: unknown };
};

// Active Worker (normal path)
let sudachiWorker: Worker | null = null;
// Direct mode: SudachiBridge on globalThis (uncompressed fallback)
let directModeReady = false;

/**
 * Initialize Sudachi in a Web Worker.
 * The Worker handles Brotli decompression and JS evaluation off the main
 * thread. Calls onProgress(0.9) when decompression finishes, and the
 * returned Promise resolves when the Worker signals ready (100%).
 */
export function initSudachiWorker(
  compressedData: Uint8Array,
  onProgress?: (ratio: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./sudachi-worker.js', { type: 'module' });

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (e.data.type === 'decompressed') {
        onProgress?.(0.9);
      } else if (e.data.type === 'ready') {
        sudachiWorker = worker;
        onProgress?.(1.0);
        resolve();
      } else if (e.data.type === 'error') {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };

    worker.onerror = err => {
      worker.terminate();
      reject(new Error(err.message));
    };

    // Transfer buffer ownership — zero-copy
    worker.postMessage({ type: 'init', data: compressedData }, [
      compressedData.buffer,
    ]);
  });
}

/**
 * Tokenize text via Sudachi.
 * Uses the Worker when available, direct main-thread call as fallback.
 */
export function tokenize(text: string): Promise<string> {
  if (sudachiWorker) {
    return tokenizeViaWorker(text);
  }
  if (directModeReady) {
    return tokenizeDirectly(text);
  }
  return Promise.reject(new Error('Sudachi not initialized'));
}

function tokenizeViaWorker(text: string): Promise<string> {
  const worker = sudachiWorker!;
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerOutMessage>) => {
      if (e.data.type === 'tokenized') {
        worker.removeEventListener('message', handler);
        resolve(e.data.json);
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'tokenize', text });
  });
}

function tokenizeDirectly(text: string): Promise<string> {
  try {
    const bridge = getSudachiModule();
    const json = bridge.tokenize(text, bridge.TokenizeMode.C);
    return Promise.resolve(json);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Load uncompressed Sudachi bundle on the main thread (fallback path).
 */
export async function loadUncompressedSudachi(): Promise<boolean> {
  try {
    console.log('Loading: Loading uncompressed Sudachi bundle...');
    const moduleUrl = './sudachi-bundle.js';
    await import(moduleUrl);
    const ready = await waitForSudachiBridge();
    if (ready) directModeReady = true;
    return ready;
  } catch (error) {
    console.error(
      'Error: Failed to load uncompressed Sudachi dictionary:',
      error
    );
    return false;
  }
}

async function waitForSudachiBridge(
  maxAttempts = 50,
  intervalMs = 100
): Promise<boolean> {
  let attempts = 0;
  while (
    !(globalThis as Record<string, unknown>).SudachiBridge &&
    attempts < maxAttempts
  ) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }
  if ((globalThis as Record<string, unknown>).SudachiBridge) {
    console.log('Success: SudachiBridge detection successful');
    return true;
  }
  console.error('Error: SudachiBridge initialization timeout');
  return false;
}

export function getSudachiModule(): SudachiBridge {
  const bridge = (globalThis as Record<string, unknown>).SudachiBridge as
    | SudachiBridge
    | undefined;
  if (!bridge) throw new Error('Sudachi module is not loaded');
  return bridge;
}

export function isSudachiLoaded(): boolean {
  return sudachiWorker !== null || directModeReady;
}
