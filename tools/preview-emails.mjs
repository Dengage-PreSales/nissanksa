/* Renders the message bodies in panel/lincoln/ the way a send would, and
   screenshots each one, so a template is looked at before it is pasted into
   the panel and mailed to anyone.

   The substitution here is a stand in for Dengage's engine, not a copy of it,
   and it is deliberately strict: it understands only the two constructs these
   templates use, and it reports anything it could not resolve rather than
   quietly leaving it on the page. A leftover tag in the output means the
   template uses something this check has never seen, which is exactly the
   thing worth knowing before a send rather than after one.

   It renders each body twice, at the two ends of what a message has to
   survive: a booking where the visitor gave everything, and a moment where
   they have given nothing at all and only the four always sent values exist.

   Serve the repository root first, because the preview reads the banners from
   there rather than over the network: the published copies and the committed
   ones are the same bytes, and this way the check reports a layout fault
   rather than a sandbox without egress.

       python3 -m http.server 8101
       node tools/preview-emails.mjs
       # writes to .preview/emails/ , which git ignores */
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIRS = ['panel/lincoln', 'panel/nissan'];
const OUT = '.preview/emails';
const ORIGIN = 'http://localhost:8101/lincoln/';

/* Everything a visitor can give, and the same message with none of it. */
const FULL = {
  model: 'Navigator', model_id: 'navigator', model_seats: '8', model_category: 'SUV',
  model_url: ORIGIN + 'vehicles/navigator/',
  model_image: ORIGIN + 'assets/cms/storage/lincoln_common/navigator-2025/overview/main-banner/desktop/overview-main-banner.jpg',
  booking_url: ORIGIN + 'forms/testdrive/?model=Navigator',
  first_name: 'Salil', full_name: 'Salil Kapoor', gsm: '+966 55 512 3456',
  email: 'name@example.com', city: 'Jeddah', branch: 'Lincoln Jeddah, Madinah Road',
  purchase_horizon: 'Within 1 month', booking_ref: 'DPS-LC-1788172000',
};
const BARE = {
  model: 'Lincoln', model_url: ORIGIN,
  model_image: ORIGIN + 'assets/cms/storage/lincoln_common/100-years-of-lincoln/header-background-image.jpg',
  booking_url: ORIGIN + 'forms/testdrive/',
};
/* Nissan publishes a starting price and no seat count, and its messages carry
   no photograph, so its bodies are rendered with what they actually receive. */
Object.assign(FULL, { model_price: 'SAR 270,999' });

function render(html, values) {
  let out = html;
  for (;;) {
    const next = out.replace(
      /\{%\s*if\s*\(\$Current\.([a-z_]+)\)\s*\{\s*%\}([\s\S]*?)\{%\s*\}\s*%\}/,
      (_m, tag, body) => {
        const [yes, no = ''] = body.split(/\{%\s*\}\s*else\s*\{\s*%\}/);
        return values[tag] ? yes : no;
      },
    );
    if (next === out) break;
    out = next;
  }
  return out.replace(/\{%=\s*\$Current\.([a-z_]+)\s*%\}/g, (_m, tag) => values[tag] ?? '');
}

mkdirSync(OUT, { recursive: true });
const bodies = SRC_DIRS.flatMap((dir) =>
  readdirSync(dir).filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .map((f) => ({ dir, file: f })));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
let problems = 0;

for (const { dir, file } of bodies) {
  const source = readFileSync(join(dir, file), 'utf8');
  for (const [variant, values] of [['filled', FULL], ['bare', BARE]]) {
    const html = render(source, values);
    const leftover = html.match(/\{%[\s\S]{0,50}/g);
    const name = `${dir.split('/').pop()}.${file.replace(/\.html$/, '')}.${variant}`;
    const path = join(OUT, name + '.html');
    writeFileSync(path, html);
    await page.goto('file://' + join(process.cwd(), path));
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: join(OUT, name + '.png'), fullPage: true });
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
    /* A tag that resolved to nothing leaves a double space or a gap before
       punctuation, which is what an unguarded value looks like on a phone. */
    const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' '));
    const faults = [];
    if (leftover) faults.push('unresolved template syntax: ' + leftover[0].slice(0, 50));
    if (broken.length) faults.push('image did not load: ' + broken[0]);
    if (text.trim().length < 200) faults.push('body rendered almost empty');
    const gap = text.match(/\S {2,}\S|\s[.,?]/);
    if (gap) faults.push('a value rendered empty near: ' + gap[0]);
    if (faults.length) { problems++; console.log('  FAIL ' + name + ' :: ' + faults.join('; ')); }
    else console.log('  ok   ' + name);
  }
}

await browser.close();
console.log(problems ? `${problems} previews need attention` : 'every message renders, filled and bare');
process.exit(problems ? 1 : 0);
