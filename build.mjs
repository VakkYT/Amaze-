/**
 * Inlines src/ into a single self-contained page.
 *
 * The sources stay real ES modules so the engine can be unit-tested with plain
 * node; the build only strips the module keywords and splices everything into
 * one IIFE, which is what an Artifact needs (its CSP admits no local scripts).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(resolve(root, p), 'utf8');

const [tpl, css, engine, app] = await Promise.all(
  ['src/template.html', 'src/style.css', 'src/engine.js', 'src/app.js'].map(read),
);

const script = [
  engine.replace(/^export\s+/gm, ''),
  app.replace(/^import\s+\{[\s\S]*?\}\s+from\s+'\.\/engine\.js';\n/m, ''),
].join('\n\n');

const out = tpl
  .replace('/*__STYLE__*/', () => css.trim())
  .replace('/*__SCRIPT__*/', () => `(function () {\n'use strict';\n\n${script}\n})();`);

if (/__STYLE__|__SCRIPT__/.test(out)) throw new Error('a placeholder was left unfilled');
if (/\bexport\b|\bimport\b/.test(script)) throw new Error('module syntax survived into the bundle');

await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/amaze.html'), out);
console.log(`dist/amaze.html — ${(out.length / 1024).toFixed(1)} kB`);
