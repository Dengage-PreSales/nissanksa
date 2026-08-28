#!/usr/bin/env node
// The small-screen census, born from a phone recording of the Tekton page.
// Runs the everything-works checks at a phone viewport and at desktop, plus
// the structural checks a phone surfaced: nothing may paint across the header
// brand, no captured third party frame or captcha may remain, the WhatsApp
// floater must carry its glyph, no page may scroll sideways, and the page's
// last controls must clear the fixed corner buttons.
// Serve the repository root first: python3 -m http.server 8101
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
];
const VIEWPORTS = [
  { name: 'phone', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
];

const browser = await chromium.launch();
let issues = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch,
  });
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE)) return route.abort();
    return route.continue();
  });
  console.log(`\n===== ${vp.name} ${vp.width}x${vp.height} =====`);

  for (const p of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(900);
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    const report = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
        const cs = getComputedStyle(el);
        return r.width > 4 && r.height > 4 && cs.display !== 'none' &&
               cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
      };

      // 1. Sideways scroll.
      const hscroll = document.scrollingElement.scrollWidth - document.documentElement.clientWidth;

      // 2. Text painting across the header brand.
      const overlaps = [];
      const brand = document.querySelector('header .dps-brand, .dps-brand');
      if (brand && visible(brand)) {
        const b = brand.getBoundingClientRect();
        for (const el of document.querySelectorAll('body *')) {
          if (el === brand || brand.contains(el) || el.contains(brand)) continue;
          if (!visible(el)) continue;
          const own = [...el.childNodes].filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim()).join(' ').trim();
          if (!own) continue;
          const r = el.getBoundingClientRect();
          const hit = !(r.right < b.left + 2 || b.right - 2 < r.left ||
                        r.bottom < b.top + 2 || b.bottom - 2 < r.top);
          if (hit) overlaps.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]} "${own.slice(0, 30)}"`);
        }
      }

      // 3. Captured third party remains.
      const extIframes = [...document.querySelectorAll('iframe')]
        .filter((i) => /^https?:/.test(i.getAttribute('src') || ''))
        .filter((i) => !i.closest('.dn-inline-slot') && !(i.getAttribute('src') || '').includes('dengage'))
        .map((i) => (i.getAttribute('src') || '').slice(0, 60));
      const captcha = document.querySelectorAll(
        '.captcha-validation, [id^="captcha-widget"], .g-recaptcha-response, input.captcha-token, .grecaptcha-badge').length;

      // 4. The floater carries its glyph.
      const wa = document.querySelector('a[data-demo-dead="whatsapp"]');
      const waBad = wa ? (visible(wa) && !wa.querySelector('svg')) : false;

      // 5. Dead visible controls (same rules as audit.mjs).
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
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50);
        dead.push(`<${el.tagName.toLowerCase()}> "${label || '(no label)'}"`);
      });

      // 6. Broken visible images.
      const broken = [];
      document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        if (!src || !visible(img)) return;
        if (/\.svg(\?|$)/i.test(src)) return;
        if (img.complete && img.naturalWidth === 0) broken.push(src.slice(-60));
      });

      return { hscroll, overlaps, extIframes, captcha, waBad, dead, broken };
    });

    // 7. At the very bottom, the page's own controls must clear the fixed buttons.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    const clash = await page.evaluate(() => {
      const fixed = [...document.querySelectorAll('.dps-controls button, a[data-demo-dead="whatsapp"]')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter((f) => f.r.width > 0);
      const out = [];
      document.querySelectorAll('a[href], button, [role="button"]').forEach((el) => {
        if (el.closest('.dps-controls') || el.hasAttribute('data-demo-dead')) return;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed') return;
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) return;
        for (const f of fixed) {
          const hit = !(r.right < f.r.left || f.r.right < r.left || r.bottom < f.r.top || f.r.bottom < r.top);
          if (hit) {
            out.push(`"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" under fixed control`);
            break;
          }
        }
      });
      return [...new Set(out)];
    });

    const bad = (report.hscroll > 2 ? 1 : 0) + report.overlaps.length + report.extIframes.length +
      report.captcha + (report.waBad ? 1 : 0) + report.dead.length + report.broken.length + clash.length;
    issues += bad;
    console.log(`${bad ? 'ISSUES' : 'clean '} ${p}  hscroll:${report.hscroll} overlap:${report.overlaps.length} extFrame:${report.extIframes.length} captcha:${report.captcha} waGlyph:${report.waBad ? 'MISSING' : 'ok'} dead:${report.dead.length} img:${report.broken.length} clash:${clash.length}`);
    const uniq = (a) => [...new Set(a)];
    uniq(report.overlaps).slice(0, 6).forEach((o) => console.log('   over  ' + o));
    uniq(report.extIframes).slice(0, 4).forEach((o) => console.log('   frame ' + o));
    uniq(report.dead).slice(0, 10).forEach((o) => console.log('   dead  ' + o));
    uniq(report.broken).slice(0, 6).forEach((o) => console.log('   img   ' + o));
    clash.slice(0, 6).forEach((o) => console.log('   clash ' + o));
    await page.close();
  }
  await ctx.close();
}

console.log(`\nTOTAL issues across both viewports: ${issues}`);
await browser.close();
process.exit(issues ? 1 : 0);
