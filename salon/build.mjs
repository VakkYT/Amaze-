/**
 * Empaqueta salon/src en una sola página autocontenida.
 *
 * Igual que el build de Amaze: las fuentes siguen siendo módulos ES de verdad
 * para poder probar el engine con node a secas, y el build sólo les quita las
 * palabras de módulo y las mete en un IIFE, que es lo que admite un Artifact
 * (su CSP no acepta scripts locales).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(resolve(root, p), 'utf8');

const [tpl, css, engine, paint, app] = await Promise.all(
  ['src/template.html', 'src/style.css', 'src/engine.js', 'src/paint.js', 'src/app.js'].map(read),
);

const strip = (source) => source
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+'[^']+';\n/gm, '')
  .replace(/^export\s+/gm, '');

const script = [engine, paint, app].map(strip).join('\n\n');

const out = tpl
  .replace('/*__STYLE__*/', () => css.trim())
  .replace('/*__SCRIPT__*/', () => `(function () {\n'use strict';\n\n${script}\n})();`);

if (/__STYLE__|__SCRIPT__/.test(out)) throw new Error('quedó un marcador sin llenar');
if (/^\s*(export|import)\b/m.test(script)) throw new Error('sobrevivió sintaxis de módulo en el paquete');

await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/salon.html'), out);
console.log(`salon/dist/salon.html — ${(out.length / 1024).toFixed(1)} kB`);
