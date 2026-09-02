/* The phone check, and why it is separate from tools/audit-mobile.mjs.
 *
 * The mobile audit measures a page at a phone viewport: overlaps, horizontal
 * scroll, dead controls, broken images. It reported this build clean while the
 * one control every phone visitor reaches for first, the hamburger, had never
 * worked. It missed it because it never pressed anything.
 *
 * That failure had a precise shape worth keeping in view. The captured
 * stylesheet parks the menu drawer off the right edge with
 * transform: translateX(100%), and the real site slid it back by toggling a
 * class this build does not use. So the drawer opened, took its full size, and
 * reported display block, visibility visible, opacity 1 to anything that asked
 * it. Every property a check would read said "open". It sat one screen width
 * to the right of the viewport.
 *
 * So this file presses things and then asks a different question: is the box
 * actually inside the viewport. That is the assertion the earlier check was
 * missing, and it is the one that catches an off screen panel, a zero height
 * drawer and a control hidden behind another element alike.
 *
 *     python3 -m http.server 8101
 *     node tools/mobile-check.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium, devices } = require('playwright');

const BASE = 'http://localhost:8101/';
/* Both phones a room actually holds. The iPhone is the one that matters most:
   it is the narrower of the two and the only one where web push has an extra
   condition attached. */
const PHONES = ['iPhone 13', 'Pixel 7'];
/* A thumb needs about 44 points. Anything smaller is a control someone will
   miss on the first press and blame the demo for. */
const MIN_TAP = 40;

let failures = 0;
const fail = (msg) => { failures += 1; console.log('FAIL ' + msg); };
const ok = (msg) => console.log('  ok ' + msg);

/* Inside the viewport, not merely "displayed". A box that is 359 wide and sits
   at x=390 on a 390 wide screen passes every style check and is invisible. */
const onScreen = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    found: true,
    w: Math.round(r.width), h: Math.round(r.height),
    left: Math.round(r.left), top: Math.round(r.top),
    vw: window.innerWidth, vh: window.innerHeight,
    painted: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05,
    /* Most of it has to be on screen, not a sliver: a drawer showing its last
       nine pixels is as broken as one showing none. */
    inside: r.width > 40 && r.height > 40 &&
            Math.min(r.right, window.innerWidth) - Math.max(r.left, 0) > r.width * 0.6 &&
            Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) > 40,
  };
}, selector);

for (const phoneName of PHONES) {
  const device = devices[phoneName];
  if (!device) { fail(`this playwright has no profile for ${phoneName}`); continue; }
  console.log('\n' + phoneName + '  ' + device.viewport.width + 'x' + device.viewport.height);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...device });
  /* The demo's own bytes only. The SDK hosts are refused and the refusal is
     asserted below, so a run writes nothing into the shared Dengage account. */
  let reachedSdk = 0;
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    if (/dengage\.com/.test(url)) reachedSdk += 1;
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));

  const open = async (path) => {
    errors.length = 0;
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1200);
    if (errors.length) fail(`${phoneName}: page error on ${path}: ${errors[0]}`);
  };

  /* 1. The hamburger, on every page type. The drawer is the only navigation a
        phone has, so one page working is not enough. */
  for (const path of ['index.html', 'vehicles/x-trail/index.html', 'offers/index.html',
                      'my-showroom/index.html', 'book-a-test-drive/index.html']) {
    await open(path);
    const burger = page.locator('.burger').first();
    if (!(await burger.count())) { fail(`${phoneName}: no hamburger on ${path}`); continue; }
    const box = await burger.boundingBox();
    if (!box || box.width < MIN_TAP || box.height < MIN_TAP) {
      fail(`${phoneName}: the hamburger on ${path} is ${Math.round(box ? box.width : 0)}x` +
           `${Math.round(box ? box.height : 0)}, under ${MIN_TAP}`);
    }
    await burger.tap();
    await page.waitForTimeout(500);
    const drawer = await onScreen(page, 'header.c_010D aside.sidebar-mobile');
    if (!drawer.found) fail(`${phoneName}: ${path} has no menu drawer`);
    else if (!drawer.painted) fail(`${phoneName}: the menu drawer on ${path} did not paint`);
    else if (!drawer.inside) {
      fail(`${phoneName}: the menu drawer on ${path} opened off screen ` +
           `(${drawer.w}x${drawer.h} at ${drawer.left},${drawer.top} in ${drawer.vw}x${drawer.vh})`);
    } else ok(`${phoneName}: the menu opens on ${path}`);
  }

  /* 2. The demo's own pages are in that menu. The captured menu is Nissan's
        and lists Nissan's site, so without this block a phone cannot reach
        My Showroom or the configurator at all. */
  await open('index.html');
  await page.locator('.burger').first().tap();
  await page.waitForTimeout(400);
  const wanted = ['configure/', 'compare/', 'find-your-nissan/', 'my-showroom/',
                  'offers/', 'book-a-test-drive/', 'request-a-quote/',
                  'finance-calculator/', 'find-a-showroom/', 'shop-at-home/'];
  const links = await page.evaluate(() => {
    const nav = document.querySelector('aside.sidebar-mobile .dps-shortcuts');
    return nav ? [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href')) : null;
  });
  if (!links) fail(`${phoneName}: the menu carries no shortcuts to this demo's own pages`);
  else {
    const missing = wanted.filter((w) => !links.some((h) => (h || '').indexOf(w) !== -1));
    if (missing.length) fail(`${phoneName}: the menu is missing ${missing.join(', ')}`);
    else ok(`${phoneName}: all ${wanted.length} demo pages are one tap from the menu`);
  }

  /* 3. Every one of those shortcuts resolves. A menu entry that 404s on a call
        is worse than no menu entry. */
  const hrefs = links || [];
  let dead = 0;
  for (const href of hrefs) {
    const url = new URL(href.split('#')[0], BASE + 'index.html').toString();
    const res = await page.request.get(url).catch(() => null);
    if (!res || !res.ok()) { dead += 1; fail(`${phoneName}: menu link ${href} answers ${res ? res.status() : 'nothing'}`); }
  }
  if (!dead && hrefs.length) ok(`${phoneName}: every menu link resolves`);

  /* 4. The close control, because the drawer covers all but a thumb's width of
        the screen and tapping the strip beside it is not a control. */
  const closeBtn = page.locator('.dps-shortcuts-close');
  if (!(await closeBtn.count())) fail(`${phoneName}: the menu drawer has no close control`);
  else {
    await closeBtn.tap();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() =>
      document.querySelector('header.c_010D').classList.contains('dps-menu-open'));
    if (after) fail(`${phoneName}: the menu close control did not close it`);
    else ok(`${phoneName}: the menu closes`);
  }

  /* 5. The launcher and the bell, the demo's own two panels. */
  for (const [button, panel, name] of [['.dps-launch', '#dengage-panel', 'launcher'],
                                       ['.dps-bell', '#inbox', 'message drawer']]) {
    await open('index.html');
    const b = page.locator(button);
    if (!(await b.count())) { fail(`${phoneName}: no ${name} button`); continue; }
    const box = await b.boundingBox();
    if (!box || box.width < MIN_TAP || box.height < MIN_TAP) {
      fail(`${phoneName}: the ${name} button is under ${MIN_TAP} across`);
    }
    await b.tap();
    await page.waitForTimeout(600);
    const shown = await onScreen(page, panel);
    if (!shown.found) fail(`${phoneName}: the ${name} panel is not on the page`);
    else if (!shown.inside) {
      fail(`${phoneName}: the ${name} opened off screen ` +
           `(${shown.w}x${shown.h} at ${shown.left},${shown.top} in ${shown.vw}x${shown.vh})`);
    } else ok(`${phoneName}: the ${name} opens on screen`);
  }

  /* 6. The presenter pages are one tap from the launcher, on the device the
        presenter is holding. Typing a URL mid call is not a route. */
  const presenter = await page.evaluate(() =>
    [...document.querySelectorAll('#launcher-grid .scenario[data-action]')]
      .map((el) => el.getAttribute('data-action')));
  for (const action of ['go-dealer', 'go-verify']) {
    if (presenter.indexOf(action) === -1) fail(`${phoneName}: the launcher has no ${action} card`);
  }
  if (presenter.indexOf('go-dealer') !== -1 && presenter.indexOf('go-verify') !== -1) {
    ok(`${phoneName}: the cockpit and the console are one tap from the launcher`);
  }

  /* 7. What iOS needs before a web push can ever arrive. Android needs none of
        it; on an iPhone a missing manifest means the permission prompt is not
        offered at all, which is indistinguishable from a broken demo. */
  await open('index.html');
  const pwa = await page.evaluate(() => ({
    manifest: (document.querySelector('link[rel="manifest"]') || {}).href || null,
    appleCapable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"][content="yes"]'),
    appleIcon: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || null,
  }));
  if (!pwa.manifest) fail(`${phoneName}: no web app manifest, so iOS can never deliver a push`);
  if (!pwa.appleCapable) fail(`${phoneName}: no apple-mobile-web-app-capable meta`);
  if (!pwa.appleIcon) fail(`${phoneName}: no apple-touch-icon, so the Home Screen icon is a screenshot`);
  if (pwa.manifest) {
    const res = await page.request.get(pwa.manifest).catch(() => null);
    if (!res || !res.ok()) fail(`${phoneName}: the manifest answers ${res ? res.status() : 'nothing'}`);
    else {
      const body = await res.json().catch(() => null);
      if (!body) fail(`${phoneName}: the manifest is not readable JSON`);
      else if (body.display !== 'standalone') {
        fail(`${phoneName}: the manifest says display ${body.display}; iOS needs standalone`);
      } else if (!(body.icons || []).some((i) => /512/.test(i.sizes || ''))) {
        fail(`${phoneName}: the manifest has no 512 icon`);
      } else ok(`${phoneName}: the Home Screen app is declared, so iOS push can be granted`);
    }
  }
  /* Every icon the manifest and the head name is really there. A 404 here is
     invisible until someone adds the demo to their Home Screen on a call. */
  for (const icon of ['assets/brand/icon-180.png', 'assets/brand/icon-192.png',
                      'assets/brand/icon-512.png']) {
    const res = await page.request.get(BASE + icon).catch(() => null);
    if (!res || !res.ok()) fail(`${phoneName}: ${icon} answers ${res ? res.status() : 'nothing'}`);
  }

  /* 8. The journey itself, on a phone. Navigation working is not the same as
        the demo working: a form nobody can submit and a popup that hangs off
        the edge both pass every check above. */
  await open('book-a-test-drive/index.html?model=x-trail');
  const funnel = await page.evaluate(() => (window.__mobEvents = [], true));
  await page.evaluate(() => {
    window.addEventListener('dps:nissanksa:event', (e) => window.__mobEvents.push(e.detail.action));
  });
  await page.fill('input[name="FirstName"]', 'Phone').catch(() => {});
  await page.fill('input[name="LastName"]', 'Check').catch(() => {});
  await page.fill('input[name="Phone"]', '0555555555').catch(() => {});
  await page.fill('input[name="Email"]', 'phone.check@example.com').catch(() => {});
  await page.evaluate(() => {
    const form = document.querySelector('select[name="Model"]').closest('form');
    form.querySelectorAll('select').forEach((sel) => {
      if (!sel.value && sel.options.length > 1) {
        sel.selectedIndex = 1;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    form.querySelectorAll('input[type="checkbox"][required]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(300);
  /* Tapped rather than submitted from script, because a submit button under
     another element is exactly the failure this file exists to catch. */
  const submit = page.locator('form.hasValidation button[type="submit"], ' +
                              'form.hasValidation input[type="submit"], .submit-form-button').first();
  if (!(await submit.count())) fail(`${phoneName}: the booking form has no submit control`);
  else {
    await submit.tap({ timeout: 8000 }).catch((e) => {
      fail(`${phoneName}: the booking submit could not be tapped: ` +
           (String(e).match(/intercepts pointer events/) ? 'something is on top of it' : 'timed out'));
    });
    await page.waitForTimeout(900);
    const evs = await page.evaluate(() => window.__mobEvents || []);
    const missing = ['ec:beginCheckout', 'ec:order'].filter((w) => evs.indexOf(w) === -1);
    if (missing.length) fail(`${phoneName}: booking on a phone did not write ${missing.join(', ')}`);
    else if (!(await page.locator('.dps-form-done').count())) {
      fail(`${phoneName}: booking on a phone showed no confirmation`);
    } else ok(`${phoneName}: a test drive can be booked on a phone`);
  }

  /* The configurator, which is the one page built entirely by this demo and
     the one whose cards are small enough to worry about. */
  await open('configure/index.html?model=x-trail');
  const grade = page.locator('[data-trim-name]').first();
  if (!(await grade.count())) fail(`${phoneName}: the configurator shows no grades`);
  else {
    const gb = await grade.boundingBox();
    if (!gb || gb.height < MIN_TAP) fail(`${phoneName}: a grade card is only ${Math.round(gb ? gb.height : 0)} tall`);
    await grade.tap({ timeout: 8000 }).catch(() => fail(`${phoneName}: a grade card could not be tapped`));
    await page.waitForTimeout(600);
    const reserve = await onScreen(page, '[data-cfg-reserve]');
    if (!reserve.found) fail(`${phoneName}: choosing a grade offered no way to reserve it`);
    else if (!reserve.painted) fail(`${phoneName}: the reserve control did not paint after choosing a grade`);
    else ok(`${phoneName}: a grade can be chosen and reserved on a phone`);
  }

  /* A creative, fired from the launcher, has to fit the screen it is drawn on.
     A popup wider than the phone is the one failure a room sees instantly. */
  await open('index.html');
  await page.locator('.dps-launch').tap();
  await page.waitForTimeout(500);
  await page.locator('#launcher-grid [data-scenario="newsletter-capture"]').tap().catch(() => {});
  await page.waitForTimeout(900);
  const creative = await onScreen(page, '#dps-lc-host .dps-lc-panel');
  if (!creative.found) fail(`${phoneName}: the newsletter experience did not draw`);
  else if (creative.w > creative.vw) {
    fail(`${phoneName}: the experience is ${creative.w} wide on a ${creative.vw} screen`);
  } else if (!creative.inside) fail(`${phoneName}: the experience drew off screen`);
  else ok(`${phoneName}: an experience fits the phone it is drawn on`);

  /* 9. Nothing above reached Dengage, so this run wrote nothing. */
  if (reachedSdk === 0) fail(`${phoneName}: the SDK hosts were never even attempted, so the refusal proves nothing`);
  else ok(`${phoneName}: ${reachedSdk} SDK attempts refused by this harness, as intended`);

  await browser.close();
}

console.log(failures ? `\n${failures} failing` : '\nall phone checks passed');
process.exit(failures ? 1 : 0);
