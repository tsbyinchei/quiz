import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CleanCSS from 'clean-css';
import { minify as htmlMinify } from 'html-minifier-terser';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { minify as terserMinify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(SOURCE_DIR, 'dist');

const SKIP_DIRS = new Set(['dist', 'node_modules', '.git']);

const DEPLOY_FILE_ALLOWLIST = new Set([
  'icon.ico'
]);

const TERSER_OPTIONS = {
  ecma: 2020,
  compress: {
    passes: 2,
    keep_fargs: false,
    pure_getters: true
  },
  mangle: true,
  format: {
    comments: false
  }
};

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.2,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

const INLINE_OBFUSCATION_OPTIONS = {
  ...OBFUSCATION_OPTIONS,
  controlFlowFlatteningThreshold: 0.15,
  stringArrayThreshold: 0.7
};

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dirPath, baseDir = dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await walk(fullPath, baseDir);
      files.push(...nested);
      continue;
    }

    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    files.push(relPath);
  }

  return files;
}

async function minifyJs(code) {
  const minified = await terserMinify(code, TERSER_OPTIONS);
  if (!minified || typeof minified.code !== 'string') {
    throw new Error('Terser failed to minify JavaScript content.');
  }
  return minified.code;
}

function obfuscateJs(code, options = OBFUSCATION_OPTIONS) {
  return JavaScriptObfuscator.obfuscate(code, options).getObfuscatedCode();
}

async function transformInlineScripts(html, relPath) {
  if (!relPath.endsWith('.html')) {
    return html;
  }

  const scriptRegex = /(<script\b(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi;
  let output = '';
  let cursor = 0;

  for (const match of html.matchAll(scriptRegex)) {
    const fullMatch = match[0];
    const openTag = match[1];
    const scriptBody = match[2] || '';
    const closeTag = match[3];
    const matchIndex = match.index || 0;

    output += html.slice(cursor, matchIndex);

    if (!scriptBody.trim()) {
      output += fullMatch;
      cursor = matchIndex + fullMatch.length;
      continue;
    }

    const minifiedInline = await minifyJs(scriptBody);
    const obfuscatedInline = obfuscateJs(minifiedInline, INLINE_OBFUSCATION_OPTIONS);
    output += `${openTag}${obfuscatedInline}${closeTag}`;

    cursor = matchIndex + fullMatch.length;
  }

  output += html.slice(cursor);
  return output;
}

async function processFile(relPath) {
  const isRootHtml = !relPath.includes('/') && relPath.endsWith('.html');
  const isAssets = relPath.startsWith('assets/');
  const isAllowed = DEPLOY_FILE_ALLOWLIST.has(relPath) || isAssets || isRootHtml;
  if (!isAllowed) {
    return false;
  }

  const srcPath = path.join(SOURCE_DIR, relPath);
  const outPath = path.join(OUTPUT_DIR, relPath);

  await ensureDir(path.dirname(outPath));

  const ext = path.extname(relPath).toLowerCase();

  if (ext === '.js') {
    const original = await fs.readFile(srcPath, 'utf8');
    const minified = await minifyJs(original);
    const shouldObfuscate = relPath.startsWith('assets/');
    const processed = shouldObfuscate
      ? obfuscateJs(minified)
      : minified;
    await fs.writeFile(outPath, processed, 'utf8');
    return true;
  }

  if (ext === '.css') {
    const original = await fs.readFile(srcPath, 'utf8');
    const result = new CleanCSS({ level: 2 }).minify(original);
    if (result.errors && result.errors.length > 0) {
      throw new Error(`CSS minify failed (${relPath}): ${result.errors.join('; ')}`);
    }
    await fs.writeFile(outPath, result.styles, 'utf8');
    return true;
  }

  if (ext === '.html') {
    const original = await fs.readFile(srcPath, 'utf8');
    const transformed = await transformInlineScripts(original, relPath);
    const minified = await htmlMinify(transformed, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      minifyCSS: true,
      minifyJS: true,
      keepClosingSlash: true
    });
    await fs.writeFile(outPath, minified, 'utf8');
    return true;
  }

  await fs.copyFile(srcPath, outPath);
  return true;
}

async function cleanOutputDir() {
  if (await fileExists(OUTPUT_DIR)) {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const cleanOnly = args.has('--clean');

  await cleanOutputDir();

  if (cleanOnly) {
    console.log('Cleaned dist directory.');
    return;
  }

  await ensureDir(OUTPUT_DIR);

  const files = await walk(SOURCE_DIR);
  let processedCount = 0;

  for (const relPath of files) {
    const copied = await processFile(relPath);
    if (copied) {
      processedCount += 1;
    }
  }

  console.log(`Build completed. Processed ${processedCount} files into: ${OUTPUT_DIR}`);
  console.log(`Dynamic HTML files (Inline scripts obfuscated): ALL ROOT HTML`);
  console.log(`Dynamic JS files (Obfuscated): ALL ASSETS JS`);
}

main().catch((error) => {
  console.error('Build failed:', error);
  process.exitCode = 1;
});

