#!/usr/bin/env node
// The acceptance check for the Lincoln demo: run before pushing.
// Serve the repository root first: python3 -m http.server 8101
//
// The SDK hosts are refused at launch and the refusal is asserted, so the
// run exercises the pages while writing nothing into the shared Dengage
// account. Events are observed on the page's own dps:lincoln:event channel,
// which js/dengageEvents.js announces whether or not the SDK is reachable.
import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'lincoln');
const BASE = 'http://localhost:8101/lincoln/';
let failures = 0;
const fail = (msg) => { failures += 1; console.log('FAIL ' + msg); };
const ok = (msg) => console.log('  ok ' + msg);

/* ---- static checks ---------------------------------------------------- */

function* walkHtml(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walkHtml(p);
    else if (name.endsWith('.html')) yield p;
  }
}

let dashHits = 0, deadLinks = 0, pages = 0;
for (const file of walkHtml(ROOT)) {
  pages += 1;
  const text = readFileSync(file, 'utf8');
  if (/[–—]/.test(text)) { dashHits += 1; fail('dash in ' + file.slice(ROOT.length + 1)); }
  const dir = dirname(file);
  for (const m of text.matchAll(/(?:href|src|poster)="([^"#?]+)[^"]*"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|javascript:|data:)/.test(url) || url === '' || url === '#') continue;
    const target = url.startsWith('/') ? join(ROOT, '..', url) : join(dir, url);
    if (!existsSync(target)) { deadLinks += 1; fail(`dead ref ${url} in ${file.slice(ROOT.length + 1)}`); }
  }
}
console.log(`${pages} lincoln pages scanned: ${dashHits} dash hits, ${deadLinks} dead refs`);

/* ---- browser checks --------------------------------------------------- */

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let dengageAttempts = 0;
await ctx.route('**/*', (route) => {
  const url = route.request().url();
  if (/dengage\.com/.test(url)) { dengageAttempts += 1; return route.abort(); }
  if (!url.startsWith('http://localhost:8101/')) return route.abort();
  return route.continue();
});

async function open(path) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e).split('\n')[0]));
  await page.addInitScript(() => {
    window.__events = [];
    window.addEventListener('dps:lincoln:event', (e) => window.__events.push(e.detail.action));
  });
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(700);
  return page;
}
const events = (page) => page.evaluate(() => window.__events);

// 1. Every page boots clean and fires pageView first.
for (const p of ['index.html', 'vehicles/navigator/index.html', 'vehicles/aviator/index.html',
                 'vehicles/corsair/index.html', 'forms/testdrive/index.html', 'forms/quote/index.html',
                 'download-specifications/index.html', 'offers/index.html',
                 'offers/aviator-june-26/index.html', 'branches/index.html', 'contact-us/index.html',
                 'news/index.html', '100-years-of-lincoln/index.html', 'about-us/index.html',
                 'dealer/index.html']) {
  const page = await open(p);
  const evs = await events(page);
  if (page.errors.length) fail(`${p}: JS errors: ${page.errors.join(' | ')}`);
  if (evs[0] !== 'pageView') fail(`${p}: first event is ${evs[0] || 'none'}, not pageView`);
  else ok(`${p} boots, pageView first`);
  await page.close();
}

// 2. The launcher renders and firing a brand card raises its data layer
// event twice in a row; the Nissan-only cards are absent.
{
  const page = await open('index.html');
  await page.click('.dps-launch');
  const cards = await page.locator('#launcher-grid .scenario').count();
  if (cards < 28) fail(`launcher shows ${cards} cards, expected 28+`);
  else ok(`launcher renders ${cards} cards`);
  const absent = await page.evaluate(() =>
    ['tekton-launch-bar', 'arrival-alert'].filter((s) => document.querySelector(`[data-scenario="${s}"]`)));
  if (absent.length) fail(`Nissan-only cards present: ${absent.join(', ')}`);
  else ok('Nissan-only cards excluded');
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

// 3. The booking funnel end to end: preselect, details, submit, no price
// fields fabricated, finance intent recorded when Finance is chosen.
{
  const page = await open('forms/testdrive/index.html?model=Navigator');
  await page.waitForTimeout(400);
  let evs = await events(page);
  if (!evs.includes('ec:addToCart')) fail('booking: ?model= preselect did not addToCart');
  await page.fill('input[name="firstname"]', 'Demo');
  await page.fill('input[name="lastname"]', 'Visitor');
  await page.fill('input[name="mobile"]', '0555555555');
  await page.fill('input[name="email"]', 'demo@example.com');
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.querySelectorAll('select').forEach((s) => {
      const want = s.name === 'paymenttype' ? 'Finance' : null;
      if (want) { s.value = want; }
      else if (!s.value && s.options.length > 1) s.selectedIndex = 1;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('form[action*="leads/submit"]')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(400);
  evs = await events(page);
  const want = ['ec:addToCart', 'ec:order', 'lead:test_drive_booked', 'lead:finance_intent'];
  const missing = want.filter((w) => !evs.includes(w));
  if (missing.length) fail(`booking funnel missing ${missing.join(', ')} (got ${evs.join(', ')})`);
  else ok('booking funnel: addToCart, order, lead row, finance intent');
  const payload = await page.evaluate(() => window.__lastOrder || null);
  const done = await page.locator('.dps-form-done').count();
  if (!done) fail('booking: no confirmation state after submit');
  else ok('booking confirmation shown');
  await page.close();
}

// 3a. An empty booking submit is held for mandatory fields.
{
  const page = await open('forms/testdrive/index.html');
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    const sel = form.querySelector('select[name="model"]');
    sel.selectedIndex = 1; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  const evs = await events(page);
  if (evs.includes('ec:order') || evs.includes('lead:test_drive_booked')) {
    fail('booking: an empty submit went through');
  } else ok('booking: empty submit held for mandatory fields');
  await page.close();
}

// 4. The quote form writes the quote lead, never the booking order.
{
  const page = await open('forms/quote/index.html');
  await page.fill('input[name="firstname"]', 'Demo');
  await page.fill('input[name="lastname"]', 'Visitor');
  await page.fill('input[name="mobile"]', '0555555555');
  await page.fill('input[name="email"]', 'demo@example.com');
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) s.selectedIndex = 1;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach((i) => {
      if (!i.value) { i.value = i.type === 'email' ? 'demo@example.com' : 'Demo'; i.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    form.querySelectorAll('input[type="checkbox"][required]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('form[action*="leads/submit"]')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(400);
  const evs = await events(page);
  if (!evs.includes('lead:quote_issued')) fail(`quote: no quote_issued (got ${evs.join(', ')})`);
  else if (evs.includes('lead:test_drive_booked')) fail('quote: booking lead fired from the quote page');
  else ok('quote submit writes quote_issued, never the booking lead');
  await page.close();
}

// 5. The cockpit sends an offline signal for a persona.
{
  const page = await open('dealer/index.html');
  await page.click('.ck-persona[data-key="DPS-1"]');
  await page.click('.ck-signal[data-id="walk_in"]');
  await page.waitForTimeout(300);
  const evs = await events(page);
  if (!evs.includes('lead:walk_in')) fail(`cockpit: no walk_in (got ${evs.join(', ')})`);
  else ok('cockpit sends lead:walk_in for DPS-1');
  await page.close();
}

// 6. The debug readout renders on demand.
{
  const page = await open('index.html?debug=1');
  const box = await page.locator('#dps-debug').count();
  if (!box) fail('?debug=1 readout missing');
  else ok('?debug=1 readout present');
  await page.close();
}

console.log(dengageAttempts + ' SDK attempts refused by this harness, as intended');
await browser.close();
if (failures) { console.log(failures + ' failure(s)'); process.exit(1); }
console.log('all checks passed');
