import subprocess, pathlib, sys
CA = '/tmp/claude-0/-home-user/cdf9c424-a457-5163-9b59-ff833a4ee113/scratchpad/ca-plus-lincoln.crt'
BASE = 'https://en.lincoln.mynaghi.com'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36'
PAGES = ['', 'vehicles/navigator', 'vehicles/aviator', 'vehicles/corsair',
         'forms/testdrive', 'forms/quote', 'forms/download-specifications',
         'offers', 'offers/aviator-june-26', 'offers/navigator-june-26',
         'branches', 'contact-us', 'news', '100-years-of-lincoln']
out = pathlib.Path(__file__).parent / 'pages'
for p in PAGES:
    name = (p or 'index').replace('/', '__') + '.html'
    r = subprocess.run(['curl', '-sS', '--cacert', CA, '--max-time', '60', '-A', UA,
                        '-o', str(out / name), '-w', '%{http_code} %{size_download}',
                        f'{BASE}/{p}'], capture_output=True, text=True)
    print(f'{p or "/"}: {r.stdout} {r.stderr.strip()[:80]}')
