// Download utility functions

export interface DownloadProgress {
  receivedLength: number;
  totalLength?: number;
  speedMBps: number;
}

export interface StreamDownloadOptions {
  url: string;
  controller: AbortController;
  onProgress?: (progress: DownloadProgress) => void;
  minSpeedMBps?: number;
  speedCheckInterval?: number;
}

/**
 * Download data with progressive streaming
 */
export async function streamDownload(
  options: StreamDownloadOptions
): Promise<Uint8Array> {
  const {
    url,
    controller,
    onProgress,
    minSpeedMBps = 0.5,
    speedCheckInterval = 10000,
  } = options;

  console.log(`Network: Fetching: ${url}`);
  const startTime = Date.now();

  const response = await fetch(url, { signal: controller.signal });
  console.log(
    `Network: Response status: ${response.status}, ok: ${response.ok}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalLength = contentLength ? parseInt(contentLength, 10) : undefined;

  console.log('Download: Starting streaming download...');
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body reader not available');
  }

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  // Speed monitoring
  let speedCheckTimeout: NodeJS.Timeout | undefined;
  const updateSpeedCheck = () => {
    clearTimeout(speedCheckTimeout);
    speedCheckTimeout = setTimeout(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMBps = receivedLength / 1024 / 1024 / elapsed;

      if (speedMBps < minSpeedMBps) {
        controller.abort();
        console.log(
          `Warning: Download speed too slow (${speedMBps.toFixed(
            2
          )}MB/s) - falling back`
        );
      }
    }, speedCheckInterval);
  };

  updateSpeedCheck();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      // Progress callback
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speedMBps = receivedLength / 1024 / 1024 / elapsed;
        onProgress(
          totalLength !== undefined
            ? { receivedLength, totalLength, speedMBps }
            : { receivedLength, speedMBps }
        );
      }

      // Progress display (every 1MB)
      if (receivedLength % (1024 * 1024) === 0 || chunks.length % 100 === 0) {
        console.log(
          `Download: Download progress: ${Math.round(receivedLength / 1024 / 1024)}MB`
        );
      }
    }
  } finally {
    clearTimeout(speedCheckTimeout);
  }

  // Combine all chunks
  console.log('🔗 Combining chunks...');
  const result = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  console.log(
    `📦 File download complete: ${Math.round(result.byteLength / 1024 / 1024)}MB`
  );
  return result;
}
