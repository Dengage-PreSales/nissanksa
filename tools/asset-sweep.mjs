/* Every page, every request, and what the server could not serve.
 *
 * A missing asset is invisible in a diff and often invisible on screen: a font
 * falls back, a decorative image leaves a gap nobody reads as a fault. This
 * loads all of them and lists what 404s, so a build can be compared against
 * the one before it rather than eyeballed.
 *
 * Needs the repository served locally:  python3 -m http.server 8101
 * Run:  node tools/asset-sweep.mjs [--base http://localhost:8101]
 */
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const baseArg = process.argv.indexOf('--base');
const BASE = (baseArg === -1 ? 'http://localhost:8101' : process.argv[baseArg + 1]).replace(/\/$/, '');

/* Every built page, found rather than listed, so a new page is never missed. */
const SKIP = new Set(['reference', 'node_modules', '.git', '.preview', 'panel', 'dist', 'assets', 'tools']);
function pages(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (entry === 'index.html') out.push(path.relative('.', full));
  }
  return out;
}

const found = pages('.').sort();
const browser = await chromium.launch();
const missingBy = new Map();
let checked = 0;

for (const page of found) {
  const ctx = await browser.newContext();
  const tab = await ctx.newPage();
  /* The SDK host is refused so a real load never races this sweep, and so a
     network fault at Dengage is never reported as a missing local asset. */
  await tab.route('**://pcdn.dengage.com/**', (r) => r.abort());
  const missing = new Set();
  tab.on('response', (r) => { if (r.status() === 404) missing.add(r.url().replace(BASE + '/', '')); });
  await tab.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' }).catch(() => {});
  await tab.waitForTimeout(300);
  checked += 1;
  for (const url of missing) {
    if (!missingBy.has(url)) missingBy.set(url, []);
    missingBy.get(url).push(page);
  }
  await ctx.close();
}
await browser.close();

const rows = [...missingBy.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`${checked} pages checked, ${rows.length} distinct assets missing\n`);
for (const [url, on] of rows) {
  console.log(`  ${String(on.length).padStart(3)} pages   ${url}`);
}
process.exit(0);
