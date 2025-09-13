import { createServer } from 'http';
import { readFileSync, existsSync, createReadStream, statSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.ts': 'text/plain',
  '.gz': 'application/gzip',
  '.br': 'application/x-brotli',
  '.wasm': 'application/wasm',
};

const server = createServer((req, res) => {
  let filePath = req.url === '/' ? '/dist/index.html' : req.url;

  // Serve from dist if file exists there, otherwise from src
  let fullPath = resolve(__dirname, '.' + filePath);

  if (!existsSync(fullPath) && filePath.startsWith('/src/')) {
    // Try dist instead for built files
    const distPath = filePath.replace('/src/', '/dist/');
    const distFullPath = resolve(__dirname, '.' + distPath);
    if (existsSync(distFullPath)) {
      fullPath = distFullPath;
      filePath = distPath;
    }
  }

  // Handle main.js specifically
  if (filePath === '/main.js') {
    fullPath = resolve(__dirname, './dist/main.js');
  }

  // Handle styles.css specifically
  if (filePath === '/styles.css') {
    fullPath = resolve(__dirname, './dist/styles.css');
  }

  // Handle sudachi-bundle.js specifically
  if (filePath === '/sudachi-bundle.js') {
    fullPath = resolve(__dirname, './dist/sudachi-bundle.js');
  }

  // Handle compressed sudachi-bundle.js.gz specifically
  if (filePath === '/sudachi-bundle.js.gz') {
    fullPath = resolve(__dirname, './dist/sudachi-bundle.js.gz');
  }

  // Handle brotli compressed sudachi-bundle.js.br specifically
  if (filePath === '/sudachi-bundle.js.br') {
    fullPath = resolve(__dirname, './dist/sudachi-bundle.js.br');
  }

  // Handle WASM files specifically
  if (filePath === '/brotli_wasm_bg.wasm') {
    fullPath = resolve(__dirname, './dist/brotli_wasm_bg.wasm');
  }

  // Handle Web Worker scripts
  if (filePath === '/sudachi-worker.js') {
    fullPath = resolve(__dirname, './dist/sudachi-worker.js');
  }

  try {
    const ext = extname(filePath);

    // 大きなファイル（.gz, .br）はストリーミング配信
    if (ext === '.gz' || ext === '.br') {
      const stats = statSync(fullPath);
      const range = req.headers.range;

      if (range) {
        // Range request support for large files with smaller chunks for Vivaldi compatibility
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

        // Limit chunk size to 8MB for better Vivaldi compatibility
        const maxChunkSize = 8 * 1024 * 1024; // 8MB
        if (end - start + 1 > maxChunkSize) {
          end = start + maxChunkSize - 1;
        }

        const chunksize = end - start + 1;

        const file = createReadStream(fullPath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });

        file.pipe(res);
      } else {
        // Normal streaming for large files
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        });

        const file = createReadStream(fullPath);
        file.pipe(res);
      }
    } else {
      // Small files - use readFileSync
      const content = readFileSync(fullPath);

      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    }
  } catch (error) {
    res.writeHead(404, {
      'Content-Type': 'text/plain',
    });
    res.end(`Not Found: ${filePath}`);
  }
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
  console.log('Make sure to run "npm run build" first');
});
