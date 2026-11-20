// Headless preview renderer:  cd tools && npm install && node render.mjs
// Serves the project folder locally, opens tools/render/index.html in headless
// Chromium (Playwright) and writes PNGs to renders/.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');   // local or global install
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const VIEWS = [
  { file: 'preview_front_3q.png', width: 1600, height: 1000, cam: [-300, 215, 560], target: [0, 64, -12], fov: 27 },
  { file: 'preview_front.png', width: 1600, height: 1000, targetCase: [105.5, 62.35, 15], offset: [0, 205, 650], fov: 24 },
  { file: 'preview_rear.png', width: 1600, height: 1000, cam: [330, 230, -470], target: [0, 62, 20], fov: 28, key: [420, 640, -560], rim: [-420, 300, 500] },
  { file: 'preview_rear_case.png', width: 1600, height: 1000, targetCase: [105.5, 62.35, 0], offset: [150, 120, -430], fov: 30, stand: false, key: [380, 620, -520], rim: [-420, 300, 500] },
  { file: 'preview_exploded.png', width: 1600, height: 1000, cam: [-600, 300, 560], target: [-10, 100, 60], fov: 30, exploded: true },
  { file: 'detail_divider.png', width: 1200, height: 800, targetCase: [105.5, 16, 15.5], offset: [-55, 42, 75], fov: 30 },
  { file: 'preview_case_only.png', width: 1600, height: 1000, targetCase: [105.5, 62.35, 8], offset: [-240, 160, 470], fov: 26, stand: false },
];

const out = path.join(ROOT, 'renders');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', e => console.error('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/tools/render/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });

const only = process.argv.slice(2);
for (const v of VIEWS.filter(v => !only.length || only.includes(v.file))) {
  const t0 = Date.now();
  const data = await page.evaluate(v => window.renderView(v), v);
  fs.writeFileSync(path.join(out, v.file), Buffer.from(data.split(',')[1], 'base64'));
  console.log(`wrote renders/${v.file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
const tex = await page.evaluate(() => window.screenTexture());
fs.writeFileSync(path.join(ROOT, 'build', 'screen_mockup_1340x800.png'), Buffer.from(tex.split(',')[1], 'base64'));
await browser.close();
server.close();
