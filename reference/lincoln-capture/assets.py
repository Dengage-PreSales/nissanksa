import re, pathlib, subprocess, collections, sys
SP = pathlib.Path('/tmp/claude-0/-home-user/cdf9c424-a457-5163-9b59-ff833a4ee113/scratchpad')
CA = str(SP / 'ca-plus-lincoln.crt')
pages = SP / 'lincoln-capture' / 'pages'
dl = SP / 'lincoln-capture' / 'dl'
urls = set()
for f in pages.glob('*.html'):
    t = f.read_text(encoding='utf-8', errors='replace')
    for u in re.findall(r'(?:src|href|data-src|poster)="([^"]+)"', t):
        if re.search(r'\.(css|js|png|jpe?g|webp|avif|svg|gif|ico|woff2?|ttf|mp4|pdf)(\?|$)', u.lower()):
            if u.startswith('/'): u = 'https://en.lincoln.mynaghi.com' + u
            if 'mynaghi.com' in u or 'alnaghicms.com' in u:
                urls.add(u.split('?')[0])
    # srcset variants
    for ss in re.findall(r'srcset="([^"]+)"', t):
        for part in ss.split(','):
            u = part.strip().split(' ')[0]
            if u.startswith('/'): u = 'https://en.lincoln.mynaghi.com' + u
            if ('mynaghi.com' in u or 'alnaghicms.com' in u) and re.search(r'\.(png|jpe?g|webp|avif|svg)(\?|$)', u.lower()):
                urls.add(u.split('?')[0])
print('to download:', len(urls))
ok = fail = 0
for u in sorted(urls):
    if 'alnaghicms.com' in u:
        rel = 'assets/cms/' + re.sub(r'^https?://cdn\.alnaghicms\.com/', '', u)
    else:
        rel = re.sub(r'^https?://(en|ar)\.lincoln\.mynaghi\.com/', '', u)
    dest = dl / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['curl', '-sS', '--cacert', CA, '--max-time', '90', '-A', 'Mozilla/5.0',
                        '-o', str(dest), '-w', '%{http_code}', u], capture_output=True, text=True)
    if r.stdout == '200': ok += 1
    else:
        fail += 1; print('  FAIL', r.stdout, u[:100])
        dest.unlink(missing_ok=True)
print(f'downloaded ok={ok} fail={fail}')
