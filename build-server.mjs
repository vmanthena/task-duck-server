import { build } from 'esbuild';

await build({
  entryPoints: ['server/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/server/index.js',
  external: ['express', 'bcryptjs', 'dotenv', 'compression'],
  treeShaking: true,
  minify: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});

console.log('✅ Server built → dist/server/index.js');
