import { build } from 'esbuild';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Point @redactjp/redact to TypeScript source so esbuild can tree-shake
// away Node.js-only code which is unused in the browser build.
const redactAlias = {
  '@redactjp/redact': resolve(__dirname, '../redact/src/index.ts'),
};

// Ensure output directories exist
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
mkdirSync(resolve(__dirname, '.tmp'), { recursive: true });

// Build TypeScript to JavaScript
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: 'dist/main.js',
  minify: false, // Disable minification for debugging
  sourcemap: true,
  alias: redactAlias,
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
    require: 'undefined',
  },
  // Mark Node.js built-ins, sudachi, and sudachi-bundle as external for browser build
  external: ['fs', 'path', 'url', 'os', 'sudachi', './sudachi-bundle.js'],
});

// Build standalone sudachi bundle to .tmp/ (intermediate)
// Skip if .br already exists in dist/ (CI cache hit)
const sudachiBrPath = resolve(
  __dirname,
  'dist/sudachi-bundle.js.br'
);
if (existsSync(sudachiBrPath)) {
  console.log(
    'Skipping sudachi-bundle build (.br exists)'
  );
} else {
  await build({
    entryPoints: ['src/sudachi-bundle.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format: 'esm',
    outfile: '.tmp/sudachi-bundle.js',
    minify: false,
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': '"production"',
      require: 'undefined',
    },
    external: ['fs', 'path', 'url', 'os'],
  });
}

// Build sudachi-integration separately for module import
await build({
  entryPoints: ['src/sudachi-integration.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: 'dist/sudachi-integration.js',
  minify: false,
  sourcemap: true,
  alias: redactAlias,
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
    require: 'undefined',
  },
  external: ['fs', 'path', 'url', 'os', 'sudachi'],
});

// Build brotli-loader separately
await build({
  entryPoints: ['src/loaders/brotli-loader.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: 'dist/brotli-loader.js',
  minify: false,
  sourcemap: true,
  alias: redactAlias,
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
    require: 'undefined',
  },
  external: ['fs', 'path', 'url', 'os', 'sudachi'],
});

// Build Sudachi Worker (decompress + eval + tokenize, all off main thread)
await build({
  entryPoints: ['src/loaders/sudachi-worker.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: 'dist/sudachi-worker.js',
  minify: false,
  sourcemap: true,
  alias: redactAlias,
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
    require: 'undefined',
  },
  external: ['fs', 'path', 'url', 'os'],
});

// Copy and process HTML
const html = readFileSync(resolve(__dirname, 'src/index.html'), 'utf-8');
writeFileSync(resolve(__dirname, 'dist/index.html'), html);

// Copy CSS
const css = readFileSync(resolve(__dirname, 'src/styles.css'), 'utf-8');
writeFileSync(resolve(__dirname, 'dist/styles.css'), css);

// Copy brotli-wasm WASM file
const wasmSrc = resolve(
  __dirname,
  '../../node_modules/brotli-wasm/pkg.web/brotli_wasm_bg.wasm'
);
const wasmDest = resolve(__dirname, 'dist/brotli_wasm_bg.wasm');
if (readFileSync) {
  const wasmBuffer = readFileSync(wasmSrc);
  writeFileSync(wasmDest, wasmBuffer);
  console.log('📦 Copied brotli-wasm WASM file');
}

console.log('Build completed successfully');
