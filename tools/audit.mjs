#!/usr/bin/env node
// The everything-works census: every page, every visible control, every
// visible image. A control counts as answered when it navigates, is wired by
// the site layer (data-dps-wired and friends), sits in a form, or belongs to
// the demo layer. An image counts as broken when it is visible and failed to
// decode. Serve the repository root first: python3 -m http.server 8101
import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');

const BASE = 'http://localhost:8101/';
const PAGES = [
  'index.html',
  'vehicles/x-trail/index.html', 'vehicles/pathfinder/index.html',
  'vehicles/altima/index.html', 'vehicles/x-terra/index.html',
  'vehicles/z/index.html', 'vehicles/patrol-pro4x/index.html',
  'vehicles/magnite/index.html', 'vehicles/patrol/index.html',
  'vehicles/kicks/index.html', 'vehicles/tekton/index.html',
  'book-a-test-drive/index.html', 'request-a-quote/index.html',
  'offers/index.html', 'offers/x-trail-999/index.html',
  'offers/kicks-august/index.html', 'offers/magnite-august/index.html',
  'finance-calculator/index.html', 'find-a-showroom/index.html',
  'shop-at-home/index.html', 'dealer/index.html',
  // With a model, so the census sees the grade cards. Without one every
  // pane is hidden and the page presents five chips and nothing else.
  'configure/index.html?model=x-trail',
  'my-showroom/index.html', 'compare/index.html', 'find-your-nissan/index.html',
  'verify/index.html',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route('**/*', (route) => {
  const url = route.request().url();
  if (!url.startsWith(BASE)) return route.abort();
  return route.continue();
});

let totalDead = 0, totalBroken = 0;
for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(900);
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(500);
  const report = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
      const cs = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && cs.display !== 'none' &&
             cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const dead = [];
    document.querySelectorAll('button, [role="button"], a').forEach((el) => {
      if (!visible(el)) return;
      if (el.closest('#dengage-panel, #inbox, #test-drive, .dps-controls, #dps-debug, #dps-lightbox')) return;
      if (el.closest('form')) return;
      const href = el.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('javascript')) return;
      if (el.hasAttribute('data-dps-wired') || el.hasAttribute('data-demo-dead') ||
          el.hasAttribute('data-open') || el.hasAttribute('data-close') ||
          el.hasAttribute('data-scenario') || el.hasAttribute('data-action') ||
          el.hasAttribute('data-save-car') || el.hasAttribute('data-mini-brochure') ||
          el.hasAttribute('data-key') || el.hasAttribute('data-id')) return;
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
      dead.push(`<${el.tagName.toLowerCase()}> "${label || '(no label)'}"`);
    });
    const broken = [];
    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!src) return;
      if (!visible(img) && img.style.visibility === 'hidden') {
        broken.push('(hidden by handler) ' + src.slice(-60));
        return;
      }
      if (!visible(img)) return;
      if (/\.svg(\?|$)/i.test(src)) return;
      if (img.complete && img.naturalWidth === 0) broken.push(src.slice(-60));
    });
    return { dead, broken };
  });
  totalDead += report.dead.length;
  totalBroken += report.broken.length;
  const state = report.dead.length || report.broken.length ? 'ISSUES' : 'clean ';
  console.log(`${state} ${p}  dead:${report.dead.length} brokenImg:${report.broken.length}`);
  const uniq = (arr) => Array.from(new Set(arr));
  uniq(report.dead).slice(0, 12).forEach((d) => console.log('   dead  ' + d));
  uniq(report.broken).slice(0, 8).forEach((b) => console.log('   img   ' + b));
  await page.close();
}
console.log(`\nTOTAL dead controls: ${totalDead}, broken images: ${totalBroken}`);
await browser.close();
process.exit(totalDead + totalBroken ? 1 : 0);
