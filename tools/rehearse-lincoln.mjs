/* The pre-call rehearsal. Walks one visitor through the whole lifecycle on the
   published build, against the live Dengage account, and reports what each
   step actually produced.

   This is the opposite of tools/verify-lincoln.mjs, and both are needed.
   Verify refuses the Dengage hosts and proves the pages behave; this lets
   every call through and proves the account answers. A demo can pass verify
   and still go quiet on a call, because a content id can be wrong, a contact
   can be unreachable, and neither is visible from inside the page.

   It starts as a genuinely new visitor: fresh storage, no identity, no
   permission granted, exactly what a prospect's browser looks like.

   WHAT IT CANNOT REHEARSE. A notification arriving. Push delivery needs a
   service worker at the origin root and a permission grant, and a headless
   browser has neither, so the message function will report that no device is
   subscribed for a brand new key. That answer is correct and is itself worth
   reading: it is what a real anonymous visitor gets before they say yes to
   notifications. The email half is real and does send.

   Run the local server first. The page bytes come from there and are served
   under the published origin, so the site sees the address it will see on the
   day, while Dengage and the message function are called for real.

       python3 -m http.server 8101
       python3 -m http.server 8101
       node tools/rehearse-lincoln.mjs --email you@example.com

   The address is required and is used for every form, because a rehearsal
   that types an invented address sends real mail to a domain that does not
   exist, and the bounce lands on the shared sending reputation. Use your own.
   The steps that submit a form are skipped without it. */
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');

const ORIGIN = 'https://dengage-presales.github.io/nissanksa/';
const LOCAL = 'http://localhost:8101/';
const BASE = ORIGIN + 'lincoln/';
const emailArg = process.argv.indexOf('--email');
const EMAIL = emailArg === -1 ? '' : process.argv[emailArg + 1];

const steps = [];
const note = (step, state, detail) => {
  steps.push({ step, state, detail: detail || '' });
  const mark = state === 'ok' ? '  ok  ' : state === 'note' ? '  --  ' : 'BREAK ';
  console.log(mark + step + (detail ? ' :: ' + detail : ''));
};

const browser = await chromium.launch({
  proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' },
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

/* The demo's own bytes, served under the address it will answer on. Dengage
   and the message function are reached for real; everything else is refused,
   so a third party asset that crept in would show up as a fault here. */
const outbound = [];
const refused = [];
const served = [];
const carried = [];
await ctx.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) {
    /* Read the bytes with Node rather than through the browser, which is
       behind a proxy that has no route back to this machine. */
    try {
      const res = await fetch(url.replace(ORIGIN, LOCAL));
      const body = Buffer.from(await res.arrayBuffer());
      return route.fulfill({
        status: res.status,
        contentType: res.headers.get('content-type') || undefined,
        body,
      });
    } catch (err) {
      served.push(url + ' :: ' + String(err).slice(0, 80));
      return route.abort();
    }
  }
  if (/dengage\.com|supabase\.co/.test(url)) {
    outbound.push(url);
    /* Carried by Node rather than by the browser. The browser here sits behind
       a proxy that answers a GET and then drops a POST without a status, so a
       request the page made correctly reads as a request that failed. Node
       reaches both hosts, so the page gets Dengage's real answer and this
       reports what Dengage really said. */
    try {
      const req = route.request();
      const res = await fetch(url, {
        method: req.method(),
        headers: req.headers(),
        body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() || undefined,
      });
      const body = Buffer.from(await res.arrayBuffer());
      return route.fulfill({
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') || 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'POST, GET, OPTIONS',
        },
        body,
      });
    } catch (err) {
      carried.push(url.split('/').pop() + ' :: ' + String(err.cause || err).slice(0, 70));
      return route.abort();
    }
  }
  refused.push(url);
  return route.abort();
});

const answers = [];
const asked = [];
ctx.on('request', (req) => {
  if (req.url().indexOf('nissan-booking-confirm') !== -1) asked.push(req.postData() || '');
});
ctx.on('response', async (res) => {
  if (res.url().indexOf('nissan-booking-confirm') === -1) return;
  try { answers.push(await res.json()); } catch (err) { answers.push({ moment: 'unreadable' }); }
});

/* One page for the whole rehearsal, navigated rather than reopened. A visitor
   moves through a site in one tab, and the behavioural rules count on that:
   how many models they have read is session state, and a fresh tab starts
   with none of it. Opening each page in its own tab makes the rules look
   broken when they are not. */
await ctx.addInitScript(() => {
  window.__events = [];
  window.addEventListener('dps:lincoln:event', (e) => window.__events.push(e.detail.action));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));

async function open(path) {
  errors.length = 0;
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(900);
  if (errors.length) note('page error on ' + path, 'break', errors[0]);
  return page;
}
const events = (p) => p.evaluate(() => window.__events);
const identity = (p) => p.evaluate(() => (window.DemoIdentity || {}).contactKey || null);
const creative = (p) => p.evaluate(() => {
  const h = document.getElementById('dps-lc-host');
  return h && h.getAttribute('data-lc-slug') ? h.getAttribute('data-lc-slug') : null;
});
const lastAnswer = (moment) => {
  for (let i = answers.length - 1; i >= 0; i -= 1) if (answers[i].moment === moment) return answers[i];
  return null;
};
function report(moment) {
  const a = lastAnswer(moment);
  if (!a) {
    const tried = asked.filter((b) => b.indexOf(moment) !== -1).length;
    return note(moment + ': asked for', 'break',
                tried ? `asked ${tried} time(s), no answer read back` : 'the page never asked');
  }
  const good = (v) => v === 'sent' || v === 'sent to this device by token';
  note(moment + ': email ' + a.email, good(a.email) ? 'ok' : 'note');
  note(moment + ': push ' + a.push, good(a.push) ? 'ok' : 'note');
}

/* 1. A visitor nobody has met. */
{
  const page = await open('index.html?debug=1');
  const evs = await events(page);
  if (evs[0] !== 'pageView') note('first visit fires pageView first', 'break', evs.join(', '));
  else note('first visit fires pageView first', 'ok');
  const key = await identity(page);
  note('anonymous, no contact key yet', key ? 'note' : 'ok', key || '');
}

/* 2. Two models read, which is what earns the invitation. */
for (const model of ['navigator', 'aviator']) {
  const page = await open('vehicles/' + model + '/index.html');
  const evs = await events(page);
  if (!evs.includes('pageView')) note(model + ' page fires pageView', 'break', evs.join(', '));
  else note(model + ' page read', 'ok');
}

/* 3. A third model page, left alone long enough to earn the invitation. */
{
  const page = await open('vehicles/corsair/index.html');
  await page.waitForTimeout(20000);
  const drawn = await creative(page);
  note('a creative appears on its own after dwelling', drawn ? 'ok' : 'break', drawn || 'nothing drew');
}

/* 4. The booking begun and left behind. */
{
  const page = await open('forms/testdrive/index.html?debug=1');
  await page.fill('input[name="firstname"]', 'Rehearsal');
  await page.fill('input[name="lastname"]', 'Visitor');
  await page.fill('input[name="mobile"]', '0555555555');
  if (EMAIL) await page.fill('input[name="email"]', EMAIL);
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
  await page.waitForTimeout(400);
  await page.evaluate(() => document.dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, clientY: 0, relatedTarget: null })));
  await page.waitForTimeout(10000);
  const drawn = await creative(page);
  note('leaving draws the rescue on the page', drawn === 'test-drive-rescue' ? 'ok' : 'note',
       drawn || 'nothing drew');
  if (EMAIL) report('abandoned_booking');
  else note('abandoned_booking: not asked, no address given', 'note', 'run with --email to send');
}

/* 5. They come back and finish it. */
if (!EMAIL) note('the submitted moments were skipped', 'note', 'pass --email to rehearse them');
else {
  const page = await open('forms/testdrive/index.html?debug=1');
  await page.fill('input[name="firstname"]', 'Rehearsal');
  await page.fill('input[name="lastname"]', 'Visitor');
  await page.fill('input[name="mobile"]', '0555555555');
  await page.fill('input[name="email"]', EMAIL);
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) s.selectedIndex = 1;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required]').forEach((c) => { c.checked = true; });
  });
  await page.waitForTimeout(400);
  const before = page.url();
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(14000);
  if (page.url() !== before) note('booking stays on the page', 'break', 'navigated to ' + page.url());
  else note('booking stays on the page', 'ok');
  const evs = await events(page);
  const missing = ['ec:addToCart', 'ec:order', 'lead:test_drive_booked'].filter((w) => !evs.includes(w));
  note('booking writes the funnel', missing.length ? 'break' : 'ok', missing.join(', '));
  const drawn = await creative(page);
  note('the booking confirmation is drawn back', drawn === 'booking-confirmed' ? 'ok' : 'break',
       drawn || 'nothing drew');
  const key = await identity(page);
  note('the visitor now has a contact key', key ? 'ok' : 'break', key || '');
  report('booking');
}

/* 6. The other two web moments. */
if (EMAIL) {
  await open('forms/quote/index.html');
  await page.fill('input[name="firstname"]', 'Rehearsal');
  await page.fill('input[name="lastname"]', 'Visitor');
  await page.fill('input[name="mobile"]', '0555555555');
  await page.fill('input[name="email"]', EMAIL);
  await page.evaluate(() => {
    const form = document.querySelector('form[action*="leads/submit"]');
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) s.selectedIndex = 1;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required]').forEach((c) => { c.checked = true; });
  });
  await page.click('.formSubmitBtn');
  await page.waitForTimeout(10000);
  report('quote');
}
{
  const page = await open('download-specifications/index.html');
  const pdf = await page.locator('a[href$=".pdf"]').first();
  if (!(await pdf.count())) note('a specification sheet is offered', 'break', 'no PDF link on the page');
  else {
    await pdf.click({ modifiers: [] }).catch(() => {});
    await page.waitForTimeout(10000);
    report('brochure');
  }
}

/* 7. The offline half, acting for the visitor this browser just became. */
{
  const page = await open('dealer/index.html');
  const acting = await page.evaluate(() => {
    const log = document.querySelector('#ck-log');
    return log ? log.innerText.replace(/\s+/g, ' ') : '';
  });
  note('the cockpit acts for the visitor from the website', /Acting for DPS-/.test(acting) ? 'ok' : 'break',
       acting.slice(0, 90));
  for (const [id, moment] of [['walk_in', 'showroom_visit'], ['test_drive_done', 'test_drive_done'],
                              ['no_show', 'no_show']]) {
    const button = page.locator(`.ck-signal[data-id="${id}"]`);
    if (!(await button.count())) { note(moment + ': cockpit control present', 'break', 'no control'); continue; }
    await button.click();
    await page.waitForTimeout(10000);
    report(moment);
  }
}

/* 8. Everything the pages reached for that was not the demo or Dengage. */
const strangers = [...new Set(refused
  .filter((u) => !u.startsWith('https://dengage-presales.github.io/'))
  .map((u) => new URL(u).host))];
note('nothing reaches a third party host', strangers.length ? 'break' : 'ok', strangers.join(', '));

note('the message function was asked ' + asked.length + ' times, answered ' + answers.length,
     asked.length === answers.length ? 'ok' : 'break');
await browser.close();
const broken = steps.filter((s) => s.state === 'break');
console.log('\n' + steps.length + ' steps, ' + broken.length + ' broken, '
            + outbound.length + ' calls made to Dengage and the message function');
if (broken.length) {
  console.log('\nWhat breaks:');
  broken.forEach((b) => console.log('  ' + b.step + (b.detail ? ' :: ' + b.detail : '')));
}
process.exit(broken.length ? 1 : 0);
