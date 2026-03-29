// src/loaders/download-utils.ts
async function streamDownload(options) {
  const {
    url,
    controller,
    onProgress,
    minSpeedMBps = 0.5,
    speedCheckInterval = 1e4
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
  const contentLength = response.headers.get("content-length");
  const totalLength = contentLength ? parseInt(contentLength, 10) : void 0;
  console.log("Download: Starting streaming download...");
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body reader not available");
  }
  const chunks = [];
  let receivedLength = 0;
  let speedCheckTimeout;
  const updateSpeedCheck = () => {
    clearTimeout(speedCheckTimeout);
    speedCheckTimeout = setTimeout(() => {
      const elapsed = (Date.now() - startTime) / 1e3;
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
      if (done)
        break;
      chunks.push(value);
      receivedLength += value.length;
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1e3;
        const speedMBps = receivedLength / 1024 / 1024 / elapsed;
        onProgress(
          totalLength !== void 0 ? { receivedLength, totalLength, speedMBps } : { receivedLength, speedMBps }
        );
      }
      if (receivedLength % (1024 * 1024) === 0 || chunks.length % 100 === 0) {
        console.log(
          `Download: Download progress: ${Math.round(receivedLength / 1024 / 1024)}MB`
        );
      }
    }
  } finally {
    clearTimeout(speedCheckTimeout);
  }
  console.log("\u{1F517} Combining chunks...");
  const result = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  console.log(
    `\u{1F4E6} File download complete: ${Math.round(result.byteLength / 1024 / 1024)}MB`
  );
  return result;
}

// src/loaders/sudachi-utils.ts
var sudachiWorker = null;
var directModeReady = false;
function initSudachiWorker(compressedData, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./sudachi-worker.js", { type: "module" });
    worker.onmessage = (e) => {
      if (e.data.type === "decompressed") {
        onProgress?.(0.9);
      } else if (e.data.type === "ready") {
        sudachiWorker = worker;
        onProgress?.(1);
        resolve();
      } else if (e.data.type === "error") {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };
    worker.postMessage({ type: "init", data: compressedData }, [
      compressedData.buffer
    ]);
  });
}
function tokenize(text) {
  if (sudachiWorker) {
    return tokenizeViaWorker(text);
  }
  if (directModeReady) {
    return tokenizeDirectly(text);
  }
  return Promise.reject(new Error("Sudachi not initialized"));
}
function tokenizeViaWorker(text) {
  const worker = sudachiWorker;
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      if (e.data.type === "tokenized") {
        worker.removeEventListener("message", handler);
        resolve(e.data.json);
      } else if (e.data.type === "error") {
        worker.removeEventListener("message", handler);
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "tokenize", text });
  });
}
function tokenizeDirectly(text) {
  try {
    const bridge = getSudachiModule();
    const json = bridge.tokenize(text, bridge.TokenizeMode.C);
    return Promise.resolve(json);
  } catch (error) {
    return Promise.reject(error);
  }
}
function getSudachiModule() {
  const bridge = globalThis.SudachiBridge;
  if (!bridge)
    throw new Error("Sudachi module is not loaded");
  return bridge;
}
function isSudachiLoaded() {
  return sudachiWorker !== null || directModeReady;
}

// src/loaders/brotli-loader.ts
var isLoading = false;
var isLoaded = false;
async function loadBrotliSudachi(onProgress) {
  if (isLoaded && isSudachiLoaded()) {
    return true;
  }
  if (isLoading) {
    await waitForLoad();
    return isLoaded;
  }
  try {
    isLoading = true;
    console.log("Loading: Downloading Brotli-compressed Sudachi dictionary...");
    const compressedData = await downloadBrotliBundle(
      (p) => onProgress?.(p * 0.7)
    );
    await initSudachiWorker(compressedData, onProgress);
    console.log(
      "Success: Brotli-compressed Sudachi dictionary loading complete"
    );
    isLoaded = true;
    return true;
  } catch (error) {
    console.error(
      "Error: Failed to load Brotli-compressed Sudachi dictionary:",
      error
    );
    return false;
  } finally {
    isLoading = false;
  }
}
async function downloadBrotliBundle(onProgress) {
  const controller = new AbortController();
  return await streamDownload({
    url: "./sudachi-bundle.js.br",
    controller,
    onProgress: (p) => {
      if (p.totalLength) {
        onProgress?.(p.receivedLength / p.totalLength);
      }
    },
    minSpeedMBps: 0.5,
    speedCheckInterval: 1e4
  });
}
async function waitForLoad() {
  while (isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
export {
  isSudachiLoaded,
  loadBrotliSudachi,
  tokenize
};
//# sourceMappingURL=brotli-loader.js.map
