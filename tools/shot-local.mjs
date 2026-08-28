#!/usr/bin/env node
// Screenshot the built pages served locally, for a side-by-side against
// reference/shots/. Serve the repository root first:
//   python3 -m http.server 8101
// then:
//   node tools/shot-local.mjs [pagePath ...]
// The SDK hosts are refused at launch and the refusal asserted, so the run
// exercises the pages, never the shared Dengage account.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reference', 'local-shots');
mkdirSync(OUT, { recursive: true });

const DEFAULT_PAGES = [
  'index.html',
  'vehicles/x-trail/index.html',
  'vehicles/patrol/index.html',
  'vehicles/altima/index.html',
  'vehicles/magnite/index.html',
  'vehicles/kicks/index.html',
  'vehicles/tekton/index.html',
  'book-a-test-drive/index.html',
  'request-a-quote/index.html',
  'offers/index.html',
  'offers/x-trail-999/index.html',
  'finance-calculator/index.html',
  'find-a-showroom/index.html',
  'shop-at-home/index.html',
];

const pages = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_PAGES;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let refused = 0;
await ctx.route('**/*', (route) => {
  const url = route.request().url();
  if (/dengage\.com/.test(url)) { refused += 1; return route.abort(); }
  if (!url.startsWith('http://localhost:8101/')) return route.abort();
  return route.continue();
});

for (const p of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  try {
    await page.goto('http://localhost:8101/' + p, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    const name = p.replace(/\/index\.html$/, '').replace(/\//g, '_') || 'home';
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
    console.log(`${p}: shot saved${errors.length ? '  JS ERRORS: ' + errors.join(' | ') : ''}`);
  } catch (e) {
    console.log(`${p}: FAILED ${String(e).split('\n')[0]}`);
  }
  await page.close();
}
console.log(`dengage requests refused during the run: ${refused} (the pages tried, the harness said no)`);
await browser.close();
