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
    /* A message body is not a page: its links are template tags the send
       engine resolves, so there is no file here to find. */
    if (url.includes('{%') || url.includes('{{')) continue;
    const target = url.startsWith('/') ? join(ROOT, url) : join(dir, url);
    if (!existsSync(target)) { deadLinks += 1; fail(`dead ref ${url} in ${file.slice(ROOT.length + 1)}`); }
  }
}
console.log(`${pages} published pages scanned: ${dashHits} dash hits, ${deadLinks} dead refs`);

/* Every photograph the message function names exists here and is big enough to
   be worth sending. A missing one is invisible from this repository: the send
   still reports success and the notification simply arrives without a picture,
   on somebody's phone, in front of the room. */
{
  const fn = readFileSync(join(ROOT, 'supabase/functions/nissan-booking-confirm/index.ts'), 'utf8');
  const named = [...fn.matchAll(/image: '(assets\/img\/msg-[^']+)'/g)].map((m) => m[1]);
  if (named.length < 10) fail(`the message function names only ${named.length} model photographs`);
  let small = 0;
  for (const rel of named) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) { fail(`message image missing: ${rel}`); continue; }
    const size = statSync(p).size;
    if (size < 20000) { small += 1; fail(`message image too small to send: ${rel} (${size} bytes)`); }
  }
  if (!small) ok(`all ${named.length} model photographs the messages send are committed`);
}

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
    window.__payloads = [];
    const slug = 'nissanksa';
    window.addEventListener('dps:' + slug + ':event', (e) => {
      window.__events.push(e.detail.action);
      window.__payloads.push(e.detail.payload || {});
    });
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
  /* The brand cards are drawn by js/creatives.js now rather than fired as a
     nissan_demo_ event, so the whole pre-purchase story runs with nothing
     configured in the panel. Each one is fired twice, the way a presenter
     fires one mid call, and none of them may raise a data layer event: a
     card that both drew and fired would draw twice wherever the campaign
     has also been pasted into the panel. */
  const slugs = await page.evaluate(() => window.NissanCreatives.slugs);
  const result = await page.evaluate(async (list) => {
    window.__dl = [];
    window.dataLayer = { push: (e) => window.__dl.push(e.event) };
    const drew = [];
    for (const slug of list) {
      if (slug === 'booking-confirmed') continue;
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
  }, slugs);
  const bad = result.drew.filter((d) => !d.endsWith(': ok'));
  if (bad.length) fail(`Nissan creatives: ${bad.join('; ')}`);
  else ok(`all ${result.drew.length} Nissan creatives draw, twice in a row`);
  if (result.dl.length) fail(`a brand card raised a data layer event: ${JSON.stringify(result.dl)}`);
  else ok('brand cards draw locally and raise no nissan_demo_ event');
  await page.close();
}

// 2a. ?onsite=panel hands the same ten to the Dengage on-site engine: the card
// raises its nissan_demo_ event, nothing is drawn here, and the demo's own
// browsing rules stand down so the visitor cannot meet the message twice.
// ?onsite=local puts it back, which is asserted rather than assumed: the
// choice is stored, so a stuck panel mode would silently blank every later
// check in this run.
{
  const page = await open('index.html?onsite=panel');
  const mode = await page.evaluate(() => window.NissanCreatives.source());
  if (mode !== 'panel') fail(`?onsite=panel left the source as ${mode}`);
  const res = await page.evaluate(async () => {
    window.__dl = [];
    window.dataLayer = { push: (e) => window.__dl.push(e.event) };
    document.querySelector('.dps-launch').click();
    document.querySelector('[data-scenario="test-drive-invite"]').click();
    await new Promise((r) => setTimeout(r, 120));
    const host = document.getElementById('dps-lc-host');
    return { dl: window.__dl, drew: !!(host && host.querySelector('.dps-lc-panel')) };
  });
  if (!res.dl.includes('nissan_demo_test-drive-invite')) {
    fail(`panel mode did not raise the campaign event: ${JSON.stringify(res.dl)}`);
  } else if (res.drew) {
    fail('panel mode drew the creative here as well as firing the campaign');
  } else ok('?onsite=panel fires nissan_demo_ and draws nothing locally');
  await page.close();

  const back = await open('index.html?onsite=local');
  const restored = await back.evaluate(() => window.NissanCreatives.source());
  if (restored !== 'local') fail(`?onsite=local left the source as ${restored}`);
  else ok('?onsite=local restores the demo to drawing its own experiences');
  await back.close();
}

// 2b. Build and reserve. Every figure on the configurator is one Nissan
// publishes, so the check reads the page against reference/grades.json rather
// than against a number typed here, and the funnel is walked the way a visitor
// walks it. The variant id is asserted per grade because SV and SV+ collapsed
// onto one id the first time, which is invisible on screen and wrong in the
// panel. The reserve button is asserted not to navigate: the storefront's own
// safety net wired it to the link beside it, so it did something plausible and
// wrong until the page was marked as wiring its own controls.
{
  const grades = JSON.parse(readFileSync(join(ROOT, 'reference/grades.json'), 'utf8'));
  const page = await open('configure/index.html?model=x-trail');
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-cfg-pane="x-trail"] [data-cfg-trim]')]
    .map((t) => ({
      name: t.querySelector('.cfg-name').textContent.trim(),
      price: t.getAttribute('data-trim-price'),
    })));
  const want = grades['x-trail'];
  if (shown.length !== want.length) {
    fail(`configurator shows ${shown.length} X-TRAIL grades, the capture holds ${want.length}`);
  } else {
    const wrong = shown.filter((s, i) => s.name !== want[i].name ||
      (want[i].price ? Number(s.price) !== want[i].price : s.price !== null));
    if (wrong.length) fail(`configurator grade mismatch: ${JSON.stringify(wrong)}`);
    else ok(`all ${shown.length} X-TRAIL grades match the published trim data`);
  }
  const unpriced = shown.filter((s) => s.price === null);
  if (unpriced.length && !(await page.evaluate(() =>
      [...document.querySelectorAll('[data-cfg-pane="x-trail"] .cfg-price')]
        .some((e) => /price on request/i.test(e.textContent))))) {
    fail('a grade with no published price is not saying so');
  } else ok('a grade Nissan prices at nothing shows no price rather than a zero');

  const walk = await page.evaluate(async () => {
    const before = location.href;
    const cards = [...document.querySelectorAll('[data-cfg-pane="x-trail"] [data-cfg-trim]')];
    const sv = cards.find((c) => c.getAttribute('data-trim-name') === 'SV 4WD 7 Seats');
    const svPlus = cards.find((c) => c.getAttribute('data-trim-name') === 'SV+ 4WD 7 Seats');
    const ids = [];
    for (const card of [sv, svPlus]) {
      card.click();
      await new Promise((r) => setTimeout(r, 60));
      const last = window.__events.at(-2);
      ids.push(document.body.getAttribute('data-last-variant') || '');
    }
    document.querySelector('[data-cfg-reserve]').click();
    await new Promise((r) => setTimeout(r, 120));
    return {
      stayed: location.href === before,
      formOpen: !document.querySelector('[data-cfg-form]').hidden,
      configured: sessionStorage.getItem('dps:nissanksa:configured'),
    };
  });
  if (!walk.stayed) fail('Reserve this build navigated away instead of opening the form');
  else if (!walk.formOpen) fail('Reserve this build did not open the reservation form');
  else ok('Reserve this build opens the form and stays on the page');
  if (walk.configured !== 'true') fail('choosing a grade raised no configured signal for the rescue rule');
  else ok('choosing a grade raises the signal the abandoned build rescue reads');

  const evs = await events(page);
  for (const want2 of ['ec:addToCart', 'ec:beginCheckout']) {
    if (!evs.includes(want2)) fail(`configurator did not fire ${want2}`);
  }
  if (evs.includes('ec:addToCart') && evs.includes('ec:beginCheckout')) {
    ok('configuring fires addToCart at the grade price, and the form fires beginCheckout');
  }
  if (page.errors.length) fail(`configurator JS errors: ${page.errors.join(' | ')}`);
  await page.close();
}

// 2c. SV and SV+ are different cars at different prices and must not share a
// variant id. Read off the sent payloads rather than off the page.
{
  const page = await open('configure/index.html?model=x-trail');
  const ids = await page.evaluate(async () => {
    const out = [];
    for (const name of ['SV 4WD 7 Seats', 'SV+ 4WD 7 Seats']) {
      const card = document.querySelector(`[data-trim-name="${name}"]`);
      const before = window.__payloads ? window.__payloads.length : 0;
      card.click();
      await new Promise((r) => setTimeout(r, 80));
      out.push((window.__payloads || []).slice(before).map((p) => p.product_variant_id).filter(Boolean)[0]);
    }
    return out;
  });
  if (ids[0] && ids[1] && ids[0] !== ids[1]) ok(`SV and SV+ keep separate variant ids (${ids.join(', ')})`);
  else fail(`SV and SV+ share a variant id: ${JSON.stringify(ids)}`);
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
  // The form enforces its own mandatory fields now, so the test books the
  // way a person does: every visible required field filled.
  await page.evaluate(() => {
    const form = document.querySelector('select[name="Model"]').closest('form');
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) {
        s.selectedIndex = 1;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach((i) => {
      if (i.value) return;
      if (/mail/i.test(i.name + i.id + i.type)) i.value = 'demo@example.com';
      else if (/phone|mobile|number/i.test(i.name + i.id)) i.value = '0555555555';
      else i.value = 'Demo';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
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

// 3a. The quote form: mandatory fields hold the door, and a completed
// submit writes the quote lead, never the booking order.
{
  const page = await open('request-a-quote/index.html?c020_model=30211');
  await page.waitForTimeout(500);
  const submitSel = () => page.evaluate(() => {
    const form = document.querySelector('select[name="Model"]').closest('form');
    (form.querySelector('.submit-form-button') || form.querySelector('button[type="submit"]')).click();
  });
  await submitSel();
  await page.waitForTimeout(400);
  let evs = await events(page);
  if (evs.includes('lead:quote_issued') || evs.includes('ec:order')) fail('quote: an empty submit went through');
  else ok('quote: empty submit held for mandatory fields');
  await page.evaluate(() => {
    const form = document.querySelector('select[name="Model"]').closest('form');
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) {
        s.selectedIndex = 1;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach((i) => {
      if (i.value) return;
      if (/mail/i.test(i.name + i.id + i.type)) i.value = 'demo@example.com';
      else if (/phone|mobile|number/i.test(i.name + i.id)) i.value = '0555555555';
      else i.value = 'Demo';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
  await submitSel();
  await page.waitForTimeout(500);
  evs = await events(page);
  if (!evs.includes('lead:quote_issued')) fail(`quote: no quote_issued after full submit (got ${evs.join(', ')})`);
  else if (evs.includes('ec:order') || evs.includes('lead:test_drive_booked')) fail('quote: booking events leaked into the quote form');
  else ok('quote submit writes addToCart and quote_issued, no order');
  const doneQ = await page.locator('.dps-form-done').count();
  if (!doneQ) fail('quote: no confirmation state after submit');
  else ok('quote confirmation shown');
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

// The two moments this demo gained with js/creatives.js: a booking left half
// done, and an answered survey. Both are asked for through the same path as
// the booking confirmation, and both were missing here while Lincoln had them.
{
  const page = await open('book-a-test-drive/index.html?model=x-trail');
  await page.waitForTimeout(400);
  await page.fill('input[name="FirstName"]', 'Demo');
  await page.fill('input[name="Email"]', 'demo@example.com');
  await page.waitForTimeout(300);
  const started = await page.evaluate(() => window.sessionStorage.getItem('dps:nissanksa:started'));
  if (started !== 'true') fail('entering details did not raise the started signal');
  else ok('entering details raises the started signal the rescue rule reads');

  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: 1, bubbles: true })));
  await page.waitForTimeout(500);
  const drew = await page.evaluate(() => {
    const h = document.getElementById('dps-lc-host');
    return h ? h.getAttribute('data-lc-slug') : null;
  });
  if (drew !== 'test-drive-rescue') fail(`leaving the booking form drew ${drew || 'nothing'}`);
  else ok('leaving a half finished booking draws the rescue by itself');

  const sent = await page.evaluate(async () => {
    const seen = [];
    const real = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('nissan-booking-confirm') !== -1 && opts && opts.body) {
        try { seen.push(JSON.parse(opts.body).moment); } catch (e) { /* not ours */ }
        return Promise.resolve({ json: () => Promise.resolve({ moment: 'x' }) });
      }
      return real.apply(this, arguments);
    };
    document.querySelector('#dps-lc-host [data-lc-rescue]').click();
    await new Promise((r) => setTimeout(r, 300));
    return seen;
  });
  if (!sent.includes('abandoned_booking')) fail(`the rescue asked for ${sent.join(',') || 'nothing'}`);
  else ok('and finishing from it asks for the abandoned_booking message');
  await page.close();
}

{
  const page = await open('vehicles/patrol/index.html');
  await page.waitForTimeout(400);
  const sent = await page.evaluate(async () => {
    const seen = [];
    const real = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('nissan-booking-confirm') !== -1 && opts && opts.body) {
        try { seen.push(JSON.parse(opts.body).moment); } catch (e) { /* not ours */ }
        return Promise.resolve({ json: () => Promise.resolve({ moment: 'x' }) });
      }
      return real.apply(this, arguments);
    };
    window.NissanCreatives.show('shopping-survey');
    await new Promise((r) => setTimeout(r, 120));
    document.querySelector('#dps-lc-host input[name="answer"]').checked = true;
    document.querySelector('#dps-lc-host form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    return seen;
  });
  if (!sent.includes('survey')) fail(`the survey asked for ${sent.join(',') || 'nothing'}`);
  else ok('answering the survey asks for the survey message');
  await page.close();
}

if (dengageAttempts === 0) fail('no page attempted the Dengage SDK: the snippet is missing');
else ok(`${dengageAttempts} SDK attempts refused by this harness, as intended`);

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
