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
    /* A message body is not a page: its links are template tags the send
       engine resolves, so there is no file here to find. */
    if (url.includes('{%') || url.includes('{{')) continue;
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

// 2. The launcher renders; the Lincoln cards draw their own creative and
// raise no nissan_demo_ event, so a Nissan campaign can never answer one.
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

  const lincolnSlugs = await page.evaluate(() => window.LincolnCreatives.slugs);
  const result = await page.evaluate(async (slugs) => {
    window.__dl = [];
    window.dataLayer = { push: (e) => window.__dl.push(e.event) };
    const drew = [];
    for (const slug of slugs) {
      if (slug === 'booking-confirmed') continue;
      // twice in a row, the way a presenter fires one mid call
      for (const pass of [1, 2]) {
        document.querySelector('.dps-launch').click();
        const card = document.querySelector(`[data-scenario="${slug}"]`);
        if (!card) { drew.push(slug + ': no card'); break; }
        card.click();
        await new Promise((r) => setTimeout(r, 60));
        const host = document.getElementById('dps-lc-host');
        const shown = host && host.getAttribute('data-lc-slug') === slug &&
          host.querySelector('.dps-lc-panel');
        if (!shown) { drew.push(`${slug}: nothing drawn on pass ${pass}`); break; }
        if (pass === 2) drew.push(slug + ': ok');
        document.querySelector('#dps-lc-host [data-lc-close]').click();
      }
    }
    return { drew, dl: window.__dl };
  }, lincolnSlugs);

  const bad = result.drew.filter((d) => !d.endsWith(': ok'));
  if (bad.length) fail(`Lincoln creatives: ${bad.join('; ')}`);
  else ok(`all ${result.drew.length} Lincoln creatives draw, twice in a row`);
  if (result.dl.length) fail(`a Lincoln card raised data layer events: ${JSON.stringify(result.dl)}`);
  else ok('Lincoln cards raise no nissan_demo_ event');
  await page.close();
}

// 2a. The rules fire the creatives without anyone clicking a card.
{
  // the survey meets a reader who gets deep into a model page
  const page = await open('vehicles/navigator/index.html');
  await page.waitForTimeout(12500);
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(900);
  const slug = await page.evaluate(() => {
    const h = document.getElementById('dps-lc-host');
    return h ? h.getAttribute('data-lc-slug') : null;
  });
  if (slug !== 'shopping-survey') fail(`scroll rule drew ${slug || 'nothing'}, expected shopping-survey`);
  else ok('scroll depth on a model page draws the survey by itself');

  // and answering it writes the lead row
  await page.evaluate(() => {
    document.querySelector('#dps-lc-host input[name="answer"]').checked = true;
    document.querySelector('#dps-lc-host form[data-lc-form="survey"]')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(400);
  const evs = await events(page);
  if (!evs.includes('lead:survey_response')) fail(`survey answer wrote no lead row (got ${evs.join(', ')})`);
  else ok('the survey answer writes lead:survey_response');
  await page.close();
}

// 2b. A dwell rule fires on the offers page with no interaction at all.
{
  const page = await open('offers/index.html');
  await page.waitForTimeout(10500);
  const slug = await page.evaluate(() => {
    const h = document.getElementById('dps-lc-host');
    return h ? h.getAttribute('data-lc-slug') : null;
  });
  if (slug !== 'national-day') fail(`dwell rule drew ${slug || 'nothing'}, expected national-day`);
  else ok('dwell on the offers page draws the seasonal creative by itself');
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
  /* The real gesture, not a synthetic event: the source bundle submits from
     its own click handler through form.submit(), which raises no submit
     event at all. A dispatched event passes while a real click leaves the
     page, so the click is what this check must make. */
  const before = page.url();
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(700);
  if (page.url() !== before) fail(`booking: the submit button navigated to ${page.url()}`);
  else ok('booking: the submit button stays on the page');
  evs = await events(page);
  const want = ['ec:addToCart', 'ec:order', 'lead:test_drive_booked', 'lead:finance_intent'];
  const missing = want.filter((w) => !evs.includes(w));
  if (missing.length) fail(`booking funnel missing ${missing.join(', ')} (got ${evs.join(', ')})`);
  else ok('booking funnel: addToCart, order, lead row, finance intent');
  const done = await page.locator('.dps-form-done').count();
  if (!done) fail('booking: no confirmation state after submit');
  else ok('booking confirmation shown');

  // the on-site confirmation, carrying the details the visitor typed
  const summary = await page.evaluate(() => {
    const h = document.getElementById('dps-lc-host');
    if (!h || h.getAttribute('data-lc-slug') !== 'booking-confirmed') return null;
    return h.innerText.replace(/\s+/g, ' ');
  });
  if (!summary) fail('booking: no on-site confirmation drawn');
  else {
    const missing = ['Demo', 'Visitor', 'demo@example.com', '0555555555', 'Navigator']
      .filter((v) => summary.indexOf(v) === -1);
    if (missing.length) fail(`booking confirmation omits ${missing.join(', ')}: ${summary.slice(0, 200)}`);
    else ok('on-site confirmation repeats back the typed details');
  }
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
  const emptyBefore = page.url();
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(500);
  if (page.url() !== emptyBefore) fail(`booking: an empty submit navigated to ${page.url()}`);
  const evs = await events(page);
  if (evs.includes('ec:order') || evs.includes('lead:test_drive_booked')) {
    fail('booking: an empty submit went through');
  } else ok('booking: empty submit held for mandatory fields');
  await page.close();
}

/* 3b. Leaving the booking form after typing an address asks Dengage for the
   abandoned booking message, and carries what was already filled in. The
   request is aborted by the router above, so this watches the attempt rather
   than sending anything into the shared account. */
{
  const page = await open('forms/testdrive/index.html');
  const asks = [];
  page.on('request', (r) => {
    if (r.url().indexOf('nissan-booking-confirm') === -1) return;
    try { asks.push(JSON.parse(r.postData() || '{}')); } catch { asks.push({}); }
  });
  await page.fill('input[name="email"]', 'demo@example.com');
  await page.fill('input[name="firstname"]', 'Demo');
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    for (const name of ['model', 'city', 'purchaseplan']) {
      const sel = form.querySelector(`select[name="${name}"]`);
      if (sel && sel.options.length > 1) {
        sel.selectedIndex = 1;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await page.waitForTimeout(250);
  /* Exit intent: the pointer leaves through the top of the window. */
  await page.mouse.move(700, 300);
  await page.mouse.move(700, 2);
  await page.evaluate(() => document.dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, clientY: 0, relatedTarget: null })));
  await page.waitForTimeout(500);
  const ask = asks.find((a) => a.moment === 'abandoned_booking');
  if (!ask) fail(`abandoned booking: nothing asked for on exit (${asks.length} calls seen)`);
  else {
    const missing = ['contact_key', 'email', 'model', 'city', 'purchase_horizon']
      .filter((k) => !ask[k]);
    if (missing.length) fail(`abandoned booking: message would omit ${missing.join(', ')}`);
    else ok('leaving the booking form asks for the abandoned message, with what was typed');
  }
  await page.close();
}

{
  const page = await open('forms/testdrive/index.html');
  const asks = [];
  page.on('request', (r) => {
    if (r.url().indexOf('nissan-booking-confirm') !== -1) asks.push(r.postData() || '');
  });
  await page.evaluate(() => {
    try { sessionStorage.setItem('dps:lincoln:booked', 'true'); } catch (e) { /* private mode */ }
  });
  await page.fill('input[name="email"]', 'demo@example.com');
  await page.evaluate(() => document.dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, clientY: 0, relatedTarget: null })));
  await page.waitForTimeout(400);
  if (asks.some((a) => a.indexOf('abandoned_booking') !== -1)) {
    fail('abandoned booking: chased someone who had already booked');
  } else ok('abandoned booking: never sent to someone who already booked');
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
  const quoteBefore = page.url();
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(700);
  if (page.url() !== quoteBefore) fail(`quote: the submit button navigated to ${page.url()}`);
  const evs = await events(page);
  if (!evs.includes('lead:quote_issued')) fail(`quote: no quote_issued (got ${evs.join(', ')})`);
  else if (evs.includes('lead:test_drive_booked')) fail('quote: booking lead fired from the quote page');
  else ok('quote submit writes quote_issued, never the booking lead');
  await page.close();
}

// 4a. Every remaining lead form submits into the demo rather than leaving
// the page for the dealer's endpoint, which this demo does not host.
for (const p of ['submit-a-complaint/index.html', 'offers/navigator-june-26/index.html',
                 'offers/aviator-june-26/index.html', 'offers/corsair-june-26/index.html']) {
  const page = await open(p);
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach((i) => {
      if (i.value) return;
      i.value = /mail/i.test(i.name + i.type) ? 'demo@example.com'
        : /mobile|phone/i.test(i.name) ? '0555000555' : 'Demo';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) s.selectedIndex = 1;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
  const was = page.url();
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(700);
  const evs = await events(page).catch(() => []);
  const lead = evs.some((e) => e.startsWith('lead:'));
  if (page.url() !== was) fail(`${p}: submit navigated to ${page.url()}`);
  else if (!lead) fail(`${p}: submit raised no lead event (got ${evs.join(', ') || 'none'})`);
  else ok(`${p} submits into the demo, lead recorded`);
  await page.close();
}

// 4b. A specification download records the interest it shows.
{
  const page = await open('download-specifications/index.html');
  const links = await page.locator('a[href$=".pdf"]').count();
  if (!links) fail('download-specifications: no specification documents linked');
  await page.evaluate(() => {
    const a = document.querySelector('a[href$=".pdf"]');
    a.setAttribute('target', '_self');
    a.addEventListener('click', (e) => e.preventDefault(), true);
    a.click();
  });
  await page.waitForTimeout(400);
  const evs = await events(page);
  if (!evs.includes('lead:brochure')) fail(`brochure: no lead:brochure on download (got ${evs.join(', ')})`);
  else ok('specification download records lead:brochure');
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
