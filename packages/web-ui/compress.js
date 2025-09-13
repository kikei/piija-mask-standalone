import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { brotliCompressSync, constants } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const brPath = resolve(
  __dirname,
  'dist/sudachi-bundle.js.br'
);
if (existsSync(brPath)) {
  console.log(
    'Skipping compression (.br already exists)'
  );
  process.exit(0);
}

const srcPath = resolve(
  __dirname,
  '.tmp/sudachi-bundle.js'
);
console.log('Compressing sudachi-bundle.js...');
const sudachiBundle = readFileSync(srcPath);

const compressed = brotliCompressSync(sudachiBundle, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_SIZE_HINT]: sudachiBundle.length,
  },
});
writeFileSync(brPath, compressed);

const originalMB = Math.round(
  sudachiBundle.length / 1024 / 1024
);
const compressedMB = Math.round(
  compressed.length / 1024 / 1024
);
const ratio = (
  (1 - compressed.length / sudachiBundle.length) *
  100
).toFixed(1);

console.log(
  `Original: ${originalMB}MB -> Brotli: ${compressedMB}MB (${ratio}% reduction)`
);
