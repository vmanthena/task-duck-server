import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'zlib';
import JavaScriptObfuscator from 'javascript-obfuscator';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['client/src/main.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es2020'],
  format: 'esm',
  outdir: 'dist/public',
  entryNames: isWatch ? '[name]' : '[name]-[hash]',
  minify: !isWatch,
  treeShaking: true,
  sourcemap: isWatch,
  legalComments: 'none',
  drop: isWatch ? [] : ['debugger', 'console'],
  metafile: true,
};

const cssBuildOptions = {
  entryPoints: ['client/styles/main.css'],
  bundle: true,
  outdir: 'dist/public',
  entryNames: isWatch ? '[name]' : '[name]-[hash]',
  minify: !isWatch,
  loader: { '.woff2': 'file' },
  assetNames: 'assets/fonts/[name]',
  metafile: true,
};

function copyAssets() {
  mkdirSync('dist/public/assets', { recursive: true });
  cpSync('client/index.html', 'dist/public/index.html');
  cpSync('client/assets', 'dist/public/assets', { recursive: true });
}

/** Extract the output filename from an esbuild metafile */
function getOutputFile(metafile, ext) {
  for (const key of Object.keys(metafile.outputs)) {
    if (key.endsWith(ext) && !key.endsWith('.map')) {
      return basename(key);
    }
  }
  return null;
}

/** Inject hashed filenames into index.html */
function rewriteHtml(htmlPath, jsFile, cssFile) {
  let html = readFileSync(htmlPath, 'utf8');
  if (jsFile) html = html.replace(/main\.js/, jsFile);
  if (cssFile) html = html.replace(/main\.css/, cssFile);
  writeFileSync(htmlPath, html);
}

/** Obfuscate JS with debugger protection (production only) */
function obfuscateJs(filePath) {
  const code = readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: false,
    debugProtection: true,
    debugProtectionInterval: 4000,
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    target: 'browser',
  });
  writeFileSync(filePath, result.getObfuscatedCode());
}

/** Pre-compress static assets with gzip + brotli */
function compressAssets(dir) {
  const COMPRESSIBLE = /\.(js|css|html|json|svg|txt|xml|woff2?)$/;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      compressAssets(full);
      continue;
    }
    if (!COMPRESSIBLE.test(entry)) continue;
    const raw = readFileSync(full);
    const gz = gzipSync(raw, { level: 9 });
    writeFileSync(full + '.gz', gz);
    const br = brotliCompressSync(raw, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    });
    writeFileSync(full + '.br', br);
  }
}

/** Clean old hashed files before building */
function cleanHashedFiles(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      if (/^main-[a-zA-Z0-9]+\.(js|css)(\.gz|\.br)?$/.test(entry)) {
        rmSync(join(dir, entry));
      }
    }
  } catch { /* dir doesn't exist yet — first build */ }
}

if (isWatch) {
  const jsCtx = await context(buildOptions);
  const cssCtx = await context(cssBuildOptions);
  copyAssets();
  await jsCtx.watch();
  await cssCtx.watch();
  console.log('👀 Client watching for changes...');
} else {
  cleanHashedFiles('dist/public');

  const jsResult = await build(buildOptions);
  const cssResult = await build(cssBuildOptions);
  copyAssets();

  // Get hashed filenames from metafiles
  const jsFile = getOutputFile(jsResult.metafile, '.js');
  const cssFile = getOutputFile(cssResult.metafile, '.css');

  // Rewrite index.html with hashed references
  rewriteHtml('dist/public/index.html', jsFile, cssFile);

  // Obfuscate client JS (suppress promo banners)
  console.log('🔒 Obfuscating client JS...');
  const origStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    if (typeof chunk === 'string' && chunk.includes('[javascript-obfuscator]')) return true;
    return origStdout(chunk, ...args);
  };
  obfuscateJs(join('dist/public', jsFile));
  process.stdout.write = origStdout;

  // Pre-compress all static assets
  console.log('📦 Pre-compressing static assets...');
  compressAssets('dist/public');

  console.log(`✅ Client built → dist/public/ (${jsFile}, ${cssFile})`);
}
