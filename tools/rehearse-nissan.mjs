/* The pre-call rehearsal for the Nissan demo. Walks one visitor through the
   whole pre purchase lifecycle on the published build, against the live
   Dengage account, and reports what each step actually produced.

   This is the opposite of tools/verify.mjs, and both are needed. Verify
   refuses the Dengage hosts and proves the pages behave; this lets every call
   through and proves the account answers. A demo can pass verify and still go
   quiet on a call, because a content id can be wrong, a contact can be
   unreachable, and neither is visible from inside the page.

   It starts as a genuinely new visitor: fresh storage, no identity, no
   permission granted, exactly what a prospect's browser looks like.

   WHAT IT CANNOT REHEARSE. A notification arriving. Push delivery needs a
   service worker at the origin root and a permission grant, and a headless
   browser has neither, so the message function reports that no device is
   subscribed for a brand new key. That answer is correct and is itself worth
   reading: it is what a real anonymous visitor gets before they say yes to
   notifications. The email half is real and does send.

   Run the local server first. The page bytes come from there and are served
   under the published address, so the site sees the address it will see on
   the day, while Dengage and the message function are called for real.

       python3 -m http.server 8101
       node tools/rehearse-nissan.mjs --email you@example.com \
            --gsm 0555555555 --from facebook

   The address is required and is used for every form, because a rehearsal
   that types an invented address sends real mail to a domain that does not
   exist, and the bounce lands on the shared sending reputation. Use your own.
   The steps that submit a form are skipped without it. */
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');

const ORIGIN = 'https://dengage-presales.github.io/nissanksa/';
const LOCAL = 'http://localhost:8101/';
const BASE = ORIGIN;
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const EMAIL = arg('email', '');
const GSM = arg('gsm', '0555555555');
/* The advertisement they clicked. It is on the address of the first page only,
   which is exactly the case worth rehearsing. */
const CAMPAIGN = arg('from', '');
const ENTRY = CAMPAIGN
  ? `index.html?utm_source=${CAMPAIGN}&utm_medium=paid_social&utm_campaign=patrol_launch&debug=1`
  : 'index.html?debug=1';

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
const relayed = [];
/* Only a POST is a send. The same function also answers a GET, which is the
   bell drawer reading its messages, and counting those as sends made the run
   report a mismatch it could not explain: six asked, five answered, with no
   way to see which. A send is now counted by the moment it names, so a missing
   answer says which moment went unanswered. */
const momentOf = (body) => {
  try { return JSON.parse(body).moment || 'unnamed'; } catch (err) { return 'unreadable body'; }
};
ctx.on('request', (req) => {
  if (req.url().indexOf('nissan-lead-relay') !== -1 && req.method() === 'POST') {
    relayed.push(req.postData() || '');
  }
  if (req.url().indexOf('nissan-booking-confirm') !== -1 && req.method() === 'POST') {
    asked.push(momentOf(req.postData() || ''));
  }
});
ctx.on('response', async (res) => {
  if (res.url().indexOf('nissan-booking-confirm') === -1) return;
  if (res.request().method() !== 'POST') return;
  try { answers.push(await res.json()); } catch (err) { answers.push({ moment: 'unreadable' }); }
});

/* One page for the whole rehearsal, navigated rather than reopened. A visitor
   moves through a site in one tab, and the behavioural rules count on that:
   how many models they have read is session state, and a fresh tab starts
   with none of it. Opening each page in its own tab makes the rules look
   broken when they are not. */
await ctx.addInitScript(() => {
  window.__events = [];
  window.addEventListener('dps:nissanksa:event', (e) => window.__events.push(e.detail.action));
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
/* What Dengage said, per channel. A push to a browser that never granted
   permission cannot land, so the push line is read as a note rather than as a
   break: the sentence it prints is the answer worth reading. */
function report(moment) {
  const a = lastAnswer(moment);
  if (!a) {
    const tried = asked.filter((m) => m === moment).length;
    return note(moment + ': asked for', 'break',
                tried ? `asked ${tried} time(s), no answer read back` : 'the page never asked');
  }
  const good = (v) => v === 'sent' || v.indexOf('sent') === 0;
  note(moment + ': email ' + a.email, good(a.email) ? 'ok' : 'note');
  note(moment + ': push ' + a.push, good(a.push) ? 'ok' : 'note');
  note(moment + ': inbox ' + a.inbox, a.inbox === 'delivered' ? 'ok' : 'break');
  /* The five values every message needs whatever the visitor has told us. A
     hole in any of them is the first thing a person sees. */
  const always = ['model', 'model_url', 'model_image', 'booking_url', 'contact_url'];
  const holes = always.filter((k) => !(a.personalized || []).includes(k));
  note(moment + ': every message value resolved', holes.length ? 'break' : 'ok', holes.join(', '));
}

/* Fill whatever a Nissan form asks for. Both forms enforce their own mandatory
   fields, so a rehearsal that fills only the fields it knows by name gets held
   at the door exactly as a person would be. */
async function fillForm(p, email) {
  await p.evaluate((addr) => {
    const anchor = document.querySelector('select[name="Model"]');
    const form = anchor ? anchor.closest('form') : document.querySelector('form');
    if (!form) return;
    form.querySelectorAll('select').forEach((s) => {
      if (!s.value && s.options.length > 1) {
        s.selectedIndex = 1;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').forEach((i) => {
      if (i.value) return;
      if (/mail/i.test(i.name + i.id + i.type)) i.value = addr;
      else if (/phone|mobile|number/i.test(i.name + i.id)) i.value = '0555555555';
      else i.value = 'Rehearsal';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"][required], input[type="checkbox"][aria-required="true"]')
      .forEach((c) => { c.checked = true; });
  }, email || 'rehearsal@example.com');
  await p.waitForTimeout(300);
}
async function submitForm(p) {
  await p.evaluate(() => {
    const anchor = document.querySelector('select[name="Model"]');
    const form = anchor ? anchor.closest('form') : document.querySelector('form');
    const btn = form.querySelector('.submit-form-button')
      || form.querySelector('button[type="submit"]')
      || form.querySelector('input[type="submit"]');
    if (btn) btn.click();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/* 1. A visitor nobody has met. */
{
  const p = await open(ENTRY);
  const evs = await events(p);
  if (evs[0] !== 'pageView') note('first visit fires pageView first', 'break', evs.join(', '));
  else note('first visit fires pageView first', 'ok');
  const key = await identity(p);
  note('anonymous, no contact key yet', key ? 'note' : 'ok', key || '');
  if (CAMPAIGN) {
    const held = await p.evaluate(() => {
      try { return localStorage.getItem('dps:nissanksa:campaign'); } catch (e) { return null; }
    });
    note('the campaign that brought them is held', held ? 'ok' : 'break', held || 'nothing stored');
  }
}

/* 2. Two models read, which is what earns the invitation. */
for (const model of ['x-trail', 'pathfinder']) {
  const p = await open('vehicles/' + model + '/index.html');
  const evs = await events(p);
  if (!evs.includes('pageView')) note(model + ' page fires pageView', 'break', evs.join(', '));
  else note(model + ' page read', 'ok');
}

/* 3. A third model page, left alone long enough to earn the invitation. */
{
  const p = await open('vehicles/patrol/index.html');
  await p.waitForTimeout(20000);
  const drawn = await creative(p);
  note('a creative appears on its own after dwelling', drawn ? 'ok' : 'break', drawn || 'nothing drew');
}

/* 4. A car searched for, and one saved. Both write their own table. */
{
  const p = await open('index.html?debug=1');
  const before = (await events(p)).length;
  await p.evaluate(() => {
    const box = document.querySelector('input[type="search"], .dps-search input, input[name="q"]');
    if (!box) return;
    box.value = 'patrol';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    const form = box.closest('form');
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(1200);
  const evs = await events(p);
  note('a search writes search_events', evs.includes('ec:search') ? 'ok' : 'note',
       evs.slice(before).join(', ') || 'no search control on this page');
}

/* 5. A build configured and reserved. Nissan's own surface, with no Lincoln
   counterpart: it is the pre purchase moment closest to a sale. */
{
  const p = await open('configure/index.html?model=x-trail&debug=1');
  await p.waitForTimeout(600);
  const picked = await p.evaluate(() => {
    const card = document.querySelector('[data-trim-name]');
    if (!card) return null;
    card.click();
    return card.getAttribute('data-trim-name');
  });
  await p.waitForTimeout(600);
  const evs = await events(p);
  note('configuring a grade writes the cart', picked && evs.includes('ec:addToCart') ? 'ok' : 'break',
       picked || 'no grade card on the page');
  if (EMAIL && picked) {
    await p.evaluate(() => {
      const b = document.querySelector('[data-cfg-reserve]');
      if (b) b.click();
    });
    await p.waitForTimeout(700);
    await fillForm(p, EMAIL);
    await submitForm(p);
    await p.waitForTimeout(14000);
    report('reserve');
  }
}

/* 6. The booking begun and left behind. */
{
  const p = await open('book-a-test-drive/index.html?model=x-trail&debug=1');
  await p.fill('input[name="FirstName"]', 'Rehearsal').catch(() => {});
  await p.fill('input[name="LastName"]', 'Visitor').catch(() => {});
  await p.fill('input[name="Phone"]', GSM).catch(() => {});
  if (EMAIL) await p.fill('input[name="Email"]', EMAIL).catch(() => {});
  await p.waitForTimeout(400);
  await p.evaluate(() => document.dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, clientY: 0, relatedTarget: null })));
  await p.waitForTimeout(12000);
  const drawn = await creative(p);
  note('leaving draws the rescue on the page', drawn === 'test-drive-rescue' ? 'ok' : 'note',
       drawn || 'nothing drew');
  if (EMAIL) report('abandoned_booking');
  else note('abandoned_booking: not asked, no address given', 'note', 'run with --email to send');
}

/* 7. They come back and finish it. */
if (!EMAIL) note('the submitted moments were skipped', 'note', 'pass --email to rehearse them');
else {
  const p = await open('book-a-test-drive/index.html?model=x-trail&debug=1');
  await p.fill('input[name="FirstName"]', 'Rehearsal').catch(() => {});
  await p.fill('input[name="LastName"]', 'Visitor').catch(() => {});
  await p.fill('input[name="Phone"]', GSM).catch(() => {});
  await p.fill('input[name="Email"]', EMAIL).catch(() => {});
  await p.selectOption('select[name="purchaseOutlook"]', { index: 1 }).catch(() => {});
  await fillForm(p, EMAIL);
  const before = p.url();
  await submitForm(p);
  await p.waitForTimeout(14000);
  if (p.url() !== before) note('booking stays on the page', 'break', 'navigated to ' + p.url());
  else note('booking stays on the page', 'ok');
  const evs = await events(p);
  const missing = ['ec:addToCart', 'ec:beginCheckout', 'ec:order', 'lead:test_drive_booked']
    .filter((w) => !evs.includes(w));
  note('booking writes the funnel', missing.length ? 'break' : 'ok', missing.join(', '));
  const lead = relayed[relayed.length - 1] || '';
  if (CAMPAIGN) {
    note('the lead carries the campaign', lead.indexOf(CAMPAIGN) !== -1 ? 'ok' : 'break',
         (lead.match(/"utm_[a-z]+":"[^"]*"/g) || []).join(' '));
  }
  note('the lead carries the mobile', lead.indexOf(GSM.replace('+', '')) !== -1 ? 'ok' : 'break');
  note('the lead carries the purchase horizon', /purchase_horizon/.test(lead) ? 'ok' : 'note',
       (lead.match(/"purchase_horizon":"[^"]*"/) || [''])[0]);
  const done = await p.locator('.dps-form-done').count();
  note('the booking confirmation is drawn back', done ? 'ok' : 'break');
  const key = await identity(p);
  note('the visitor now has a contact key', key ? 'ok' : 'break', key || '');
  report('booking');
}

/* 8. The other two web moments. */
if (EMAIL) {
  const p = await open('request-a-quote/index.html?c020_model=30211');
  await fillForm(p, EMAIL);
  await submitForm(p);
  await p.waitForTimeout(12000);
  const evs = await events(p);
  note('the quote never writes an order', evs.includes('ec:order') ? 'break' : 'ok');
  report('quote');
}
{
  const p = await open('vehicles/x-trail/index.html');
  const clicked = await p.evaluate(() => {
    const els = [...document.querySelectorAll('a, button')];
    const b = els.find((el) => /^download( a)? brochure$/i.test(el.textContent.trim()));
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicked) note('a specification sheet is offered', 'break', 'no brochure control on the page');
  else {
    await p.waitForTimeout(12000);
    report('brochure');
  }
}

/* 9. The offline half, acting for the visitor this browser just became. */
{
  const p = await open('dealer/index.html');
  const acting = await p.evaluate(() => {
    const log = document.querySelector('#ck-log');
    return log ? log.innerText.replace(/\s+/g, ' ') : '';
  });
  note('the cockpit acts for the visitor from the website', /DPS-/.test(acting) ? 'ok' : 'note',
       acting.slice(0, 90));
  for (const [id, moment] of [['walk_in', 'showroom_visit'], ['test_drive_done', 'test_drive_done'],
                              ['no_show', 'no_show']]) {
    const button = p.locator(`.ck-signal[data-id="${id}"]`);
    if (!(await button.count())) { note(moment + ': cockpit control present', 'break', 'no control'); continue; }
    await button.click();
    await p.waitForTimeout(12000);
    report(moment);
  }
}

/* 10. Everything the pages reached for that was not the demo or Dengage. */
const strangers = [...new Set(refused
  .filter((u) => !u.startsWith('https://dengage-presales.github.io/'))
  .map((u) => new URL(u).host))];
note('nothing reaches a third party host', strangers.length ? 'break' : 'ok', strangers.join(', '));
if (served.length) note('bytes the local server could not serve', 'break', served[0]);
if (carried.length) note('calls that never reached Dengage', 'break', carried.join(' | ').slice(0, 160));

/* Which send went unanswered, rather than only that one did. */
const unanswered = [...asked];
for (const a of answers) {
  const i = unanswered.indexOf(a.moment);
  if (i !== -1) unanswered.splice(i, 1);
}
note('every send the pages made was answered: ' + asked.length + ' asked, ' + answers.length
     + ' answered', unanswered.length ? 'break' : 'ok', unanswered.join(', '));
await browser.close();
const broken = steps.filter((s) => s.state === 'break');
console.log('\n' + steps.length + ' steps, ' + broken.length + ' broken, '
            + outbound.length + ' calls made to Dengage and the message function');
if (broken.length) {
  console.log('\nWhat breaks:');
  broken.forEach((b) => console.log('  ' + b.step + (b.detail ? ' :: ' + b.detail : '')));
}
process.exit(broken.length ? 1 : 0);
