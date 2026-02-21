import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['client/src/main.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es2020'],
  format: 'esm',
  outfile: 'dist/public/main.js',
  minify: !isWatch,
  treeShaking: true,
  sourcemap: isWatch,
};

const cssBuildOptions = {
  entryPoints: ['client/styles/main.css'],
  bundle: true,
  outfile: 'dist/public/main.css',
  minify: !isWatch,
  loader: { '.woff2': 'file' },
  assetNames: 'assets/fonts/[name]',
};

function copyAssets() {
  mkdirSync('dist/public/assets', { recursive: true });
  cpSync('client/index.html', 'dist/public/index.html');
  cpSync('client/assets', 'dist/public/assets', { recursive: true });
}

if (isWatch) {
  const jsCtx = await context(buildOptions);
  const cssCtx = await context(cssBuildOptions);
  copyAssets();
  await jsCtx.watch();
  await cssCtx.watch();
  console.log('👀 Client watching for changes...');
} else {
  await build(buildOptions);
  await build(cssBuildOptions);
  copyAssets();
  console.log('✅ Client built → dist/public/');
}
