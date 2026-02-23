import { build } from 'esbuild';

await build({
  entryPoints: ['server/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/server/index.js',
  treeShaking: true,
  minify: true,
  // Bundle ALL deps — no externals, no node_modules needed at runtime
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});

console.log('✅ Server built → dist/server/index.js');
