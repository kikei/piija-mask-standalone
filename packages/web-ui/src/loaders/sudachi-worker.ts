// Web Worker: Brotli decompression + Sudachi JS evaluation + tokenization.
// All CPU-heavy work runs off the main thread.
import brotliPromise from 'brotli-wasm';

type InMessage =
  | { type: 'init'; data: Uint8Array }
  | { type: 'tokenize'; text: string };

type OutMessage =
  | { type: 'decompressed' }
  | { type: 'ready' }
  | { type: 'tokenized'; json: string }
  | { type: 'error'; message: string };

type SudachiBridge = {
  tokenize: (text: string, mode: unknown) => string;
  TokenizeMode: { C: unknown };
};

let tokenizeFn: ((text: string, mode: unknown) => string) | null = null;
let tokenizeModeC: unknown = null;

function send(msg: OutMessage): void {
  postMessage(msg);
}

addEventListener('message', async (e: MessageEvent<InMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      // Step 1: Brotli decompress
      const brotli = await brotliPromise;
      if (typeof brotli.decompress !== 'function') {
        throw new Error('Brotli decompress not available');
      }
      const decompressed = brotli.decompress(msg.data);
      const jsCode = new TextDecoder().decode(decompressed);

      // Notify main thread that decompress is done (progress 90%)
      send({ type: 'decompressed' });

      // Step 2: Load Sudachi JS as ES module via Blob URL
      const blob = new Blob([jsCode], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(blob);
      try {
        await import(moduleUrl);
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }

      // Step 3: Grab SudachiBridge from worker globalThis
      const bridge = (globalThis as Record<string, unknown>).SudachiBridge as
        | SudachiBridge
        | undefined;
      if (!bridge?.tokenize || !bridge?.TokenizeMode) {
        throw new Error('SudachiBridge not available after import');
      }

      tokenizeFn = bridge.tokenize;
      tokenizeModeC = bridge.TokenizeMode.C;

      send({ type: 'ready' });
    } catch (error) {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (msg.type === 'tokenize') {
    try {
      if (!tokenizeFn || tokenizeModeC === null) {
        throw new Error('Sudachi not initialized');
      }
      const json = tokenizeFn(msg.text, tokenizeModeC);
      send({ type: 'tokenized', json });
    } catch (error) {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});
