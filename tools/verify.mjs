#!/usr/bin/env node
// The acceptance check for this demo: about a minute, run before pushing.
// Serve the repository root first: python3 -m http.server 8101
//
// The SDK hosts are refused at launch and the refusal is asserted, so the
// run exercises the pages while writing nothing into the shared Dengage
// account. Events are observed on the page's own dps:<slug>:event channel,
// which js/dengageEvents.js announces whether or not the SDK is reachable.
import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:8101/';
let failures = 0;
const fail = (msg) => { failures += 1; console.log('FAIL ' + msg); };
const ok = (msg) => console.log('  ok ' + msg);

/* ---- static checks ---------------------------------------------------- */

function* walkHtml(dir) {
  for (const name of readdirSync(dir)) {
    if (['reference', 'node_modules', '.git'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walkHtml(p);
    else if (name.endsWith('.html')) yield p;
  }
}

// Every internal href resolves to a committed file; no em or en dashes in
// anything published.
let dashHits = 0, deadLinks = 0, pages = 0;
for (const file of walkHtml(ROOT)) {
  pages += 1;
  const text = readFileSync(file, 'utf8');
  if (/[–—]/.test(text)) { dashHits += 1; fail('dash in ' + file.slice(ROOT.length + 1)); }
  const dir = dirname(file);
  for (const m of text.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:)/.test(url) || url === '' || url === '#') continue;
    const target = url.startsWith('/') ? join(ROOT, url) : join(dir, url);
    if (!existsSync(target)) { deadLinks += 1; fail(`dead ref ${url} in ${file.slice(ROOT.length + 1)}`); }
  }
}
console.log(`${pages} published pages scanned: ${dashHits} dash hits, ${deadLinks} dead refs`);

/* ---- browser checks --------------------------------------------------- */

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let dengageAttempts = 0;
await ctx.route('**/*', (route) => {
  const url = route.request().url();
  if (/dengage\.com/.test(url)) { dengageAttempts += 1; return route.abort(); }
  if (!url.startsWith(BASE)) return route.abort();
  return route.continue();
});

async function open(path) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e).split('\n')[0]));
  await page.addInitScript(() => {
    window.__events = [];
    const slug = 'nissanksa';
    window.addEventListener('dps:' + slug + ':event', (e) => window.__events.push(e.detail.action));
  });
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(700);
  return page;
}
const events = (page) => page.evaluate(() => window.__events);

// 1. Every page boots clean and fires pageView first.
for (const p of ['index.html', 'vehicles/x-trail/index.html', 'vehicles/patrol/index.html',
                 'vehicles/magnite/index.html', 'vehicles/tekton/index.html',
                 'book-a-test-drive/index.html', 'offers/index.html',
                 'offers/x-trail-999/index.html', 'finance-calculator/index.html',
                 'find-a-showroom/index.html', 'dealer/index.html']) {
  const page = await open(p);
  const evs = await events(page);
  if (page.errors.length) fail(`${p}: JS errors: ${page.errors.join(' | ')}`);
  if (evs[0] !== 'pageView') fail(`${p}: first event is ${evs[0] || 'none'}, not pageView`);
  else ok(`${p} boots, pageView first`);
  await page.close();
}

// 2. The launcher renders every card and firing one raises its data layer
// event; firing twice keeps working.
{
  const page = await open('index.html');
  await page.click('.dps-launch');
  const cards = await page.locator('#launcher-grid .scenario').count();
  if (cards < 30) fail(`launcher shows ${cards} cards, expected 30+`);
  else ok(`launcher renders ${cards} cards`);
  const fired = await page.evaluate(() => {
    window.__dl = [];
    window.dataLayer = { push: (e) => window.__dl.push(e.event) };
    document.querySelector('[data-scenario="test-drive-invite"]').click();
    document.body.click();
    document.querySelector('.dps-launch').click();
    document.querySelector('[data-scenario="test-drive-invite"]').click();
    return window.__dl;
  });
  if (fired.filter((e) => e === 'nissan_demo_test-drive-invite').length !== 2) {
    fail(`brand card did not fire twice: ${JSON.stringify(fired)}`);
  } else ok('brand card fires its nissan_demo_ event, twice in a row');
  await page.close();
}

// 3. The booking funnel end to end: model pick, details, submit.
{
  const page = await open('book-a-test-drive/index.html?model=x-trail');
  await page.waitForTimeout(400);
  let evs = await events(page);
  if (!evs.includes('ec:addToCart')) fail('booking: ?model= preselect did not addToCart');
  await page.fill('input[name="FirstName"]', 'Demo');
  await page.fill('input[name="LastName"]', 'Visitor');
  await page.fill('input[name="Phone"]', '0555555555');
  await page.selectOption('select[name="purchaseOutlook"]', { index: 1 });
  await page.waitForTimeout(200);
  await page.click('form.hasValidation button[type="submit"], form.hasValidation input[type="submit"]').catch(async () => {
    await page.evaluate(() => {
      const sel = document.querySelector('select[name="Model"]');
      sel.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  });
  await page.waitForTimeout(400);
  evs = await events(page);
  const want = ['ec:addToCart', 'ec:beginCheckout', 'ec:order', 'lead:test_drive_booked'];
  const missing = want.filter((w) => !evs.includes(w));
  if (missing.length) fail(`booking funnel missing ${missing.join(', ')} (got ${evs.join(', ')})`);
  else ok('booking funnel: addToCart, beginCheckout, order, lead row');
  const done = await page.locator('.dps-form-done').count();
  if (!done) fail('booking: no confirmation state after submit');
  else ok('booking confirmation shown');
  await page.close();
}

// 4. The cockpit: persona plus signal.
{
  const page = await open('dealer/index.html');
  await page.click('.ck-persona[data-key="DPS-1"]');
  await page.click('.ck-signal[data-id="walk_in"]');
  await page.waitForTimeout(300);
  const evs = await events(page);
  if (!evs.includes('lead:walk_in')) fail(`cockpit: walk_in not sent (got ${evs.join(', ')})`);
  else ok('cockpit sends lead:walk_in for DPS-1');
  await page.close();
}

// 5. Brochure control records interest.
{
  const page = await open('index.html');
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, button'));
    els.find((el) => /^download( a)? brochure$/i.test(el.textContent.trim())).click();
  });
  await page.waitForTimeout(300);
  const evs = await events(page);
  if (!evs.includes('lead:brochure')) fail(`brochure click sent ${evs.join(', ')}`);
  else ok('brochure control writes its lead row');
  await page.close();
}

// 6. Finance calculator computes and signals once.
{
  const page = await open('finance-calculator/index.html');
  const before = await page.locator('#fin-monthly').textContent();
  await page.selectOption('#fin-model', 'patrol');
  await page.waitForTimeout(200);
  const after = await page.locator('#fin-monthly').textContent();
  if (!/SAR/.test(after) || before === after) fail(`finance calc did not update (${before} -> ${after})`);
  else ok(`finance calculator computes (${after.trim()})`);
  const evs = await events(page);
  if (!evs.includes('lead:finance_intent')) fail('finance intent not signalled');
  else ok('finance intent signalled');
  await page.close();
}

// 7. ?debug=1 shows the readout with rows.
{
  const page = await open('index.html?debug=1');
  const rows = await page.locator('#dps-debug').count();
  if (!rows) fail('?debug=1 readout absent');
  else ok('?debug=1 readout present');
  await page.close();
}

if (dengageAttempts === 0) fail('no page attempted the Dengage SDK: the snippet is missing');
else ok(`${dengageAttempts} SDK attempts refused by this harness, as intended`);

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
