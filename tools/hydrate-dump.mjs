#!/usr/bin/env node
// Render each source page in Chromium and save the HYDRATED DOM plus a
// full-page screenshot. The environment's egress proxy resets Chromium's own
// CONNECTs, so the browser runs fully offline: every request is intercepted
// and fetched by Node instead (Node's fetch honours HTTPS_PROXY via
// NODE_USE_ENV_PROXY and trusts the proxy CA via NODE_EXTRA_CA_CERTS), then
// fulfilled into the page. No TLS verification is disabled anywhere.
//
// Usage: NODE_USE_ENV_PROXY=1 node tools/hydrate-dump.mjs [pageName ...]
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DOM = join(ROOT, 'reference', 'hydrated');
const OUT_SHOT = join(ROOT, 'reference', 'shots');
mkdirSync(OUT_DOM, { recursive: true });
mkdirSync(OUT_SHOT, { recursive: true });

// English pages only for this build. Model paths come from the home page's
// own hrefs; Patrol, Kicks and Patrol NISMO live on separate microsites and
// are captured for content rather than as templates.
const BASE = 'https://en.nissan-saudiarabia.com';
const PAGES = {
  'home.en': `${BASE}/`,
  'x-trail.en': `${BASE}/vehicles/new/x-trail.html`,
  'pathfinder.en': `${BASE}/vehicles/new/pathfinder.html`,
  'altima.en': `${BASE}/vehicles/new/altima.html`,
  'x-terra.en': `${BASE}/vehicles/new/x-terra.html`,
  'magnite.en': `${BASE}/vehicles/new/all-new-magnite.html`,
  'z.en': `${BASE}/vehicles/new/Z.html`,
  'patrol-pro4x.en': `${BASE}/vehicles/new/patrol-pro4x.html`,
  'test-drive.en': `${BASE}/book-a-test-drive.html`,
  'quote.en': `${BASE}/request-a-quote.html`,
  'offers.en': `${BASE}/latest-offers.html`,
  'showroom.en': `${BASE}/find-a-showroom.html`,
  'shop-at-home.en': `${BASE}/shop-at-home.html`,
  'finance-calculator.en': `${BASE}/finance-calculator.html`,
  'tekton-register.en': `${BASE}/vehicles/new/tekton/register-interest.html`,
  'offer-x-trail-999.en': `${BASE}/vehicles/offers/x-trail-999-june-2026-offer.html`,
  'offer-kicks-aug.en': `${BASE}/vehicles/offers/kicks-august-2026-offer.html`,
  'offer-magnite-aug.en': `${BASE}/vehicles/offers/magnite-august-2026-offer.html`,
  'patrol-micro.en': 'https://en.allnewpatrol.nissan-saudiarabia.com/',
  'kicks-micro.en': 'https://en.allnewkicks.nissan-saudiarabia.com/',
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const cache = new Map();

async function relay(route) {
  const req = route.request();
  const url = req.url();
  if (req.method() !== 'GET') return route.abort();
  if (cache.has(url)) {
    const hit = cache.get(url);
    return route.fulfill({ status: hit.status, headers: hit.headers, body: hit.body });
  }
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept': req.headers()['accept'] || '*/*', 'accept-language': req.headers()['accept-language'] || 'en' },
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });
    const body = Buffer.from(await res.arrayBuffer());
    const headers = { 'content-type': res.headers.get('content-type') || 'application/octet-stream' };
    const entry = { status: res.status, headers, body };
    if (body.length < 8 * 1024 * 1024) cache.set(url, entry);
    return route.fulfill(entry);
  } catch (e) {
    return route.abort();
  }
}

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(PAGES);

const browser = await chromium.launch();
for (const name of names) {
  const url = PAGES[name];
  if (!url) { console.log('unknown page', name); continue; }
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
    locale: 'en-SA',
    permissions: [],           // geolocation prompts get denied, like a fresh visitor
    serviceWorkers: 'block',
  });
  await ctx.route('**/*', relay);
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(3500);
    // Dismiss the cookie banner, rejecting on purpose: this crawl must not
    // land as consented traffic in Nissan's production analytics.
    for (const label of ['Reject All', 'Reject all', 'Decline', 'رفض الكل']) {
      const btn = page.getByRole('button', { name: label });
      if (await btn.count()) { await btn.first().click().catch(() => {}); break; }
    }
    await page.waitForTimeout(800);
    // Scroll through the page so lazy sections mount and reveal.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 220));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2500);
    const html = await page.content();
    writeFileSync(join(OUT_DOM, `${name}.html`), html);
    // Reveal-on-scroll sections screenshot at opacity 0 unless animations are
    // neutralised first. This is a screenshot aid only; the saved DOM above is
    // untouched.
    await page.addStyleTag({ content: '*{transition:none!important;animation:none!important} .opacity-0{opacity:1!important}' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT_SHOT, `${name}.png`), fullPage: true });
    console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB DOM, screenshot saved`);
  } catch (e) {
    console.log(`${name}: FAILED ${String(e).split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close();
console.log('done');
