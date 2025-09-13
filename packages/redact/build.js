import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  minify: true,
  sourcemap: true,
  external: ['sudachi'],
});

console.log('Build completed');
