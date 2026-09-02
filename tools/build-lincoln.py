#!/usr/bin/env python3
"""Builds the Lincoln demo storefront under lincoln/ from the captured pages.

The capture keeps the source site's own markup, styles and JavaScript so the
replica behaves like the original; this script contains it (every link and
asset resolves inside the demo), removes what must not ship (trackers, the
dealer's lead endpoint, the Lincoln logo files), and injects the Dengage
layer: identity, SDK, the engagement modules and the five inline slot targets
the shared panel campaigns inject into.

Run from the repository root:  python3 tools/build-lincoln.py <capture-dir>
"""
import html as html_text
import json
import re
import sys
import time
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'lincoln'
STAMP = str(int(time.time()))

# source page file -> route directory under lincoln/ ('' is the home page)
PAGES = {
    'index.html': '',
    'vehicles__navigator.html': 'vehicles/navigator',
    'vehicles__aviator.html': 'vehicles/aviator',
    'vehicles__corsair.html': 'vehicles/corsair',
    'forms__testdrive.html': 'forms/testdrive',
    'forms__quote.html': 'forms/quote',
    'download-specifications.html': 'download-specifications',
    'offers.html': 'offers',
    'offers__aviator-june-26.html': 'offers/aviator-june-26',
    'offers__navigator-june-26.html': 'offers/navigator-june-26',
    'offers__corsair-june-26.html': 'offers/corsair-june-26',
    'branches.html': 'branches',
    'contact-us.html': 'contact-us',
    'news.html': 'news',
    '100-years-of-lincoln.html': '100-years-of-lincoln',
    'about-us.html': 'about-us',
    'privacy-policy.html': 'privacy-policy',
    'cookie-policy.html': 'cookie-policy',
    'terms-and-conditions.html': 'terms-and-conditions',
    'terms-of-use.html': 'terms-of-use',
    'submit-a-complaint.html': 'submit-a-complaint',
}
ROUTES = set(PAGES.values())
ALIAS = {'forms/download-specifications': 'download-specifications',
         'contact-us-form': 'contact-us'}

# Model page tab routes and news articles exist upstream but are not part of
# this pre-purchase capture; their menu entries are removed rather than left
# dead, and anything else uncaptured is unwrapped to plain text.
STRIP_LI_ROUTES = r'/vehicles/[a-z-]+/(?:gallery|design|performance|technology|compare-models)'

DENGAGE_LOGO_SVG = (
    '<svg aria-hidden="true" role="img" viewBox="0 0 38 38">'
    '<path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 '
    '23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 '
    '9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 '
    '27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 '
    '34.8307Z" fill="currentColor"></path><path d="M36.9964 15.9687C38.288 '
    '17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 '
    '32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 '
    '14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 '
    '14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z" '
    'fill="currentColor"></path></svg>'
)

def brand_block(rel):
    return (
        '<a aria-label="Dengage Auto Demo home" class="dps-brand-link" href="' + rel + 'index.html">'
        '<span aria-label="Dengage Auto Demo" class="dps-brand">' + DENGAGE_LOGO_SVG +
        '<span class="dps-brand-text"><b>DENGAGE</b><i>Auto Demo</i></span></span></a>'
    )

HEAD_INJECT = """
<!-- ORDER IN THE HEAD IS LOAD BEARING. identity.js resolves the contact key
     synchronously and must run before the SDK snippet initializes; both must
     run before any stylesheet, because a pending stylesheet blocks every
     script after it. -->
<script src="{rel}js/identity.js?v={stamp}"></script>
<!-- DENGAGE SDK START -->
<script>
  (function (window, document) {{
    window.dengage = window.dengage || function () {{
      (window.dengage.q = window.dengage.q || []).push(arguments);
    }};
    var accountId = '28';
    var appGuid = '99d9b8fb-0c62-5a85-3e43-2402554d93a5';
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://pcdn.dengage.com/p/push/' + accountId + '/' + appGuid + '/dengage_sdk_loader.js';
    document.getElementsByTagName('head')[0].appendChild(script);
    window.__dnInit ? window.dengage('initialize', window.__dnInit) : window.dengage('initialize');
  }})(window, document);
</script>
<!-- DENGAGE SDK END -->
<link rel="icon" type="image/svg+xml" href="{rel}assets/brand/favicon.svg">
<meta name="robots" content="noindex">
<!-- The same four lines the Nissan build gained on 2 September, for the same
     reason: iOS delivers a web push only to a site added to the Home Screen,
     and only offers that as a real app when the page declares a manifest with
     display standalone. Without them the permission prompt on an iPhone raised
     no dialog at all. This demo has its own manifest because it has its own
     scope, name and start page under lincoln/. -->
<link rel="manifest" href="{rel}manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Lincoln Demo">
<link rel="apple-touch-icon" href="{rel}assets/brand/icon-180.png">
"""

SCAFFOLD = """
<div class="scrim" id="scrim"></div>

<aside class="dps-drawer" id="inbox" aria-label="Lincoln updates">
  <div class="dps-drawer-head dps-modal-head">
    <h2>Lincoln updates</h2>
    <span id="inbox-count" hidden></span>
    <button type="button" id="inbox-refresh">Refresh</button>
    <button type="button" class="dps-x" data-close="1" aria-label="Close">&times;</button>
  </div>
  <div class="dps-drawer-body" id="inbox-body"></div>
</aside>

<div class="dps-modal" id="dengage-panel" role="dialog" aria-label="Dengage">
  <div class="dps-modal-head">
    <h2>Dengage</h2>
    <button type="button" class="dps-x" data-close="1" aria-label="Close">&times;</button>
  </div>
  <div class="dps-modal-body">
    <p class="dps-note">Fire any experience on this page, live. Everything lands in the Dengage panel as it happens.</p>
    <a class="dps-jump" href="{rel}dealer/index.html">Dealer cockpit, the showroom side of the same profile</a>
    <details class="ref-details">
      <summary>Quick reference</summary>
      <div id="ref-grid"></div>
    </details>
    <div class="launcher-grid" id="launcher-grid"></div>
    <h2 class="dps-h">Storefront events</h2>
    <p class="dps-note">Send a real ecommerce event to Dengage, exactly as the site itself does.</p>
    <div class="dps-field">
      <select id="event-select"></select>
    </div>
    <p id="event-note"></p>
    <button type="button" class="btn-dps" id="event-send">Send event</button>
    <button type="button" class="btn btn-quiet btn-block" id="reset-display">Reset widget display state</button>
    <div class="log" id="panel-log"></div>
  </div>
</div>

<div class="dps-controls">
  <button type="button" class="dps-bell dps-floating-bell" data-open="#inbox" aria-label="Lincoln updates">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 4a5 5 0 0 1 5 5v4l1.7 2.6H5.3L7 13V9a5 5 0 0 1 5-5z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
    <span class="dps-badge" hidden>0</span>
  </button>
  <button type="button" class="dps-launch" data-open="#dengage-panel" aria-label="Dengage demo">
    <svg viewBox="0 0 38 38"><path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/><path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/></svg>
  </button>
</div>
"""

MOUNTS = """
<link rel="stylesheet" href="{rel}assets/css/demo-controls.css?v={stamp}">
<link rel="stylesheet" href="{rel}assets/css/lincoln-overrides.css?v={stamp}">
<script src="{rel}js/config.js?v={stamp}"></script>
<script src="{rel}js/copy.js?v={stamp}"></script>
<script src="{rel}js/vehicles.js?v={stamp}"></script>
<script src="{rel}js/dengageEvents.js?v={stamp}"></script>
<script src="{rel}js/site.js?v={stamp}"></script>
<script src="{rel}js/creatives.js?v={stamp}"></script>
<script src="{rel}js/panels.js?v={stamp}"></script>
<script src="{rel}js/slots.js?v={stamp}"></script>
<script src="{rel}js/inbox.js?v={stamp}"></script>
<script src="{rel}js/debug.js?v={stamp}"></script>
"""

FOOT_NOTE = ('<div class="dps-demo-notice">A demonstration storefront built by Dengage for a '
             'sales conversation. Vehicle names and imagery come from the public Lincoln Saudi '
             'Arabia website of Mohamed Yousuf Naghi Motors; this is not their site, and no '
             'data entered here reaches Lincoln or the dealer.</div>')


def rewrite_urls(text, rel):
    # The dealer's CMS CDN and both language mirrors collapse onto the local tree.
    text = text.replace('https://cdn.alnaghicms.com/', rel + 'assets/cms/')
    text = text.replace('https://en.lincoln.mynaghi.com/', '/')
    # Arabic mirror references only appear on hreflang tags and the language
    # switch, both removed below; any survivor lands on the demo home.
    text = re.sub(r'https://ar\.lincoln\.mynaghi\.com[^"\']*', '/', text)

    def route_href(match):
        prefix, path, query, suffix = match.group(1), match.group(2), match.group(3) or '', match.group(4)
        clean = re.sub(r'^(\.\./)*', '', path.strip()).strip('/')
        clean = ALIAS.get(clean, clean)
        if clean in ROUTES:
            target = rel + (clean + '/' if clean else '') + 'index.html' + query
            return prefix + target + suffix
        return match.group(0)

    # Site absolute routes, and the footer's relative variants of the same
    # routes; whitespace inside the attribute is the capture's own.
    text = re.sub(r'(href=")(\s*(?:\.\./)*/?[a-zA-Z0-9/_-]*)(\?[^"#]*)?(")', route_href, text)
    # The Lincoln global link points at the brand's real site, externally.
    text = text.replace('href="/en/sau/"', 'href="https://www.lincoln.com/"')
    # Site absolute asset paths, after routes so pages are already resolved.
    text = re.sub(r'((?:src|href|poster|data-src)=")/(assets|css|img|fav|storage)/',
                  lambda m: m.group(1) + rel + m.group(2) + '/', text)

    def fix_srcset(match):
        parts = []
        for cand in match.group(2).split(','):
            cand = cand.strip()
            if cand.startswith('/'):
                cand = rel + cand.lstrip('/')
            parts.append(cand)
        return match.group(1) + ', '.join(parts) + '"'

    text = re.sub(r'(srcset=")([^"]*)"', fix_srcset, text)
    text = re.sub(r'url\((&quot;|["\']?)/(assets|css|img|fav|storage)/',
                  lambda m: 'url(' + m.group(1) + rel + m.group(2) + '/', text)
    return text


def neutralize_site_config(text, rel):
    # The page embeds a website_data blob the site's own JS reads: the logo it
    # may inject anywhere becomes the demo mark, and the GTM id becomes empty
    # so the tag manager can never boot from it.
    text = re.sub(r'"logo":"[^"]*"', '"logo":"' + rel + 'assets/brand/favicon.svg"', text)
    text = re.sub(r'"gtm":"[^"]*"', '"gtm":""', text)
    return text


def strip_trackers(text):
    text = re.sub(r'<script[^>]*googletagmanager[^>]*>\s*</script>', '', text)
    text = re.sub(r'<script[^>]*>(?:(?!</script>).)*?(?:googletagmanager|gtag\(|fbq\(|GTM-)(?:(?!</script>).)*?</script>',
                  '', text, flags=re.S)
    text = re.sub(r'<noscript><iframe[^>]*googletagmanager(?:(?!</noscript>).)*?</noscript>', '', text, flags=re.S)
    text = re.sub(r'<link[^>]*rel="(?:canonical|alternate)"[^>]*>', '', text)
    text = re.sub(r'<meta[^>]*property="og:url"[^>]*>', '', text)
    return text


def drop_out_of_scope(text):
    # Ownership and service pages are post purchase and not captured; the
    # menu entries and footer links go, so nothing points at a missing page.
    text = re.sub(r'<li[^>]*>(?:(?!</li>).)*?href="[^"]*/owners(?:(?!</li>).)*?</li>\s*', '', text, flags=re.S)
    text = re.sub(r'<a[^>]*href="[^"]*/owners[^"]*"(?:(?!</a>).)*?</a>', '', text, flags=re.S)
    # The language switch points at the Arabic mirror, which is not part of
    # this build; the standing decision is full English first.
    text = re.sub(r'<a[^>]*hreflang[^>]*>(?:(?!</a>).)*?</a>', '', text, flags=re.S)
    # Model page tab routes exist upstream but are separate uncaptured pages;
    # their menu entries go rather than sit dead.
    text = re.sub(r'<li[^>]*>(?:(?!</li>).)*?href="' + STRIP_LI_ROUTES + r'"(?:(?!</li>).)*?</li>\s*',
                  '', text, flags=re.S)
    # The capture's own favicon set 404s on the source server; the demo icon
    # is injected in the head instead.
    text = re.sub(r'<link[^>]*rel="[^"]*icon[^"]*"[^>]*fav/[^>]*>', '', text)
    return text


def unwrap_leftover_links(text):
    # Anything still pointing at an uncaptured site route becomes plain text:
    # a control that cannot act is removed, never left dead.
    def unwrap(match):
        return re.sub(r'</?a\b[^>]*>', '', match.group(0))
    text = re.sub(r'<a[^>]*href="\s*/[^"]*"[^>]*>(?:(?!</a>).)*?</a>', unwrap, text, flags=re.S)
    # The source footer's Sitemap entry carries a bare "#" on the live site
    # too; here it goes rather than sit dead.
    text = re.sub(r'<a[^>]*href="#"[^>]*>\s*Sitemap\s*</a>', '', text)
    # The branch map renders as a static image here; its zoom buttons do
    # nothing without the source site's map service, so they go.
    text = re.sub(r'<button[^>]*class="zoom-(?:in|out)"[^>]*>(?:(?!</button>).)*?</button>', '', text, flags=re.S)
    # The model subnav's tab routes were stripped above, which leaves its
    # dropdown holding only an Overview link to the page itself; the toggle
    # becomes the static model name it visually is.
    text = re.sub(r'<a class="menu-target" href="#">((?:(?!</a>).)*?)<div class="downarrow">(?:(?!</a>).)*?</a>',
                  lambda m: '<span class="menu-target">' + m.group(1) + '</span>', text, flags=re.S)
    return text


def swap_logos(text, rel):
    block = brand_block(rel)
    # Peel any anchor wrapped around a wordmark image first, so the swap can
    # never nest the demo mark's own anchor inside the original one.
    text = re.sub(r'<a[^>]*>\s*(<img[^>]*(?:lincoln_logo\.svg|lincoln-logo\.png)[^>]*>)\s*</a>',
                  lambda m: m.group(1), text, flags=re.S)
    text = re.sub(r'<a[^>]*>\s*(<img[^>]*(?:lincoln_logo\.svg|lincoln-logo\.png)[^>]*>)',
                  lambda m: m.group(1), text, flags=re.S)
    text = re.sub(r'(<img[^>]*(?:lincoln_logo\.svg|lincoln-logo\.png)[^>]*>)\s*</a>',
                  lambda m: m.group(1), text, flags=re.S)
    # Every wordmark image becomes the demo mark, keeping the image's own
    # classes so the header's responsive show and hide behavior survives.
    def carry(match, make):
        cls = re.search(r'class="([^"]*)"', match.group(0))
        return make((cls.group(1) + ' ') if cls else '')

    text = re.sub(r'<img[^>]*(?:lincoln_logo\.svg|lincoln-logo\.png)[^>]*>',
                  lambda m: carry(m, lambda extra: block.replace('class="dps-brand-link"',
                                                                'class="' + extra + 'dps-brand-link"')),
                  text)
    # The dealer's own logo image follows the same rule; the name survives
    # as plain text, the way a site title would.
    text = re.sub(r'<img[^>]*Al-Naghi-Motors[^>]*>',
                  lambda m: carry(m, lambda extra: '<span class="' + extra +
                                  'dps-dealer-name">Mohamed Yousuf Naghi Motors Co.</span>'),
                  text)
    # The language switch would only loop back to this page; full English
    # first is the standing decision.
    text = re.sub(r'<div class="lang-switcher">(?:(?!</div>).)*?</div>', '', text, flags=re.S)
    # The footer copyright is text, not a dead link.
    text = re.sub(r'<a[^>]*href="#"[^>]*>\s*(©[^<]*)</a>', lambda m: m.group(1).strip(), text)
    return text


BELL = (
    '<button type="button" class="dps-bell dps-header-bell" data-open="#inbox" '
    'aria-label="Lincoln updates">'
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'
    '<path d="M12 4a5 5 0 0 1 5 5v4l1.7 2.6H5.3L7 13V9a5 5 0 0 1 5-5z"/>'
    '<path d="M10 19a2 2 0 0 0 4 0"/></svg>'
    '<span class="dps-badge" hidden>0</span>'
    '</button>'
)


def inject_bell(text):
    """The inbox bell sits in the header beside the menu, where a site puts a
    notification control, rather than floating over the page. Both header
    clusters take one: the capture uses a separate block for small screens, and
    each is hidden at the width the other serves."""
    placed = 0

    def once(match):
        nonlocal placed
        placed += 1
        return match.group(0) + BELL

    text = re.sub(r'<div class="header-right\s+header-right-warpper">', once, text, count=1)
    text = re.sub(r'<div class="header-right desktop-none">', once, text, count=1)
    if not placed:
        # No header cluster on this page: keep the bell reachable rather than lost.
        text = text.replace('<div class="dps-controls">', '<div class="dps-controls">' + BELL, 1)
    return text


def inject_slots(text, route):
    def after(pattern, snippet, s, count=1):
        return re.sub(pattern, lambda m: m.group(0) + snippet, s, count=count, flags=re.S)

    text = after(r'</header>|</nav>', '\n<div id="dn_inline_target_below_header"></div>', text)
    if route == '':
        text = after(r'</section>', '\n<div id="dn_inline_target_below_hero"></div>', text)
        text = after(r'<div id="dn_inline_target_below_hero"></div>\s*(?:(?!</section>).)*?</section>',
                     '\n<div id="dn_inline_target_in_grid"></div>', text)
        text = after(r'<div id="dn_inline_target_in_grid"></div>',
                     '\n<div id="dn_inline_target_reco"></div>', text)
    if route.startswith('vehicles/'):
        text = after(r'</section>', '\n<div id="dn_inline_target_pdp_below_price"></div>', text)
        text = after(r'<div id="dn_inline_target_pdp_below_price"></div>',
                     '\n<div id="dn_inline_target_reco"></div>', text)
    text = re.sub(r'<footer', '<div id="dn_inline_target_above_footer"></div>\n<footer', text, count=1)
    return text


def inject_branches(text, capture):
    # The source page ships its branch locator empty: a map script fills it at
    # runtime from the site's /dealers endpoint and third party tile servers,
    # none of which exist inside this self contained capture. The same branch
    # data, captured once from that endpoint, is baked in as cards instead,
    # and the locator shell is removed so the map script stands down cleanly.
    dealers = json.loads((capture.parent / 'dealers.json').read_text(encoding='utf-8'))
    cards = []
    for d in dealers['data']['dealers_info']:
        title = html_text.escape((d.get('data_title') or '').strip())
        street = (d.get('data_address_street') or '').strip().rstrip(',')
        city = (d.get('data_address_city') or '').strip()
        addr = ', '.join(p for p in (street, city) if p)
        tel = str(d.get('data_contact_telephone') or '').strip()
        directions = (d.get('data_directionsUrl') or '').strip()
        bits = ['<h3 class="dps-branch-title">' + title + '</h3>']
        if addr:
            bits.append('<p class="dps-branch-addr">' + html_text.escape(addr) + '</p>')
        links = []
        if tel:
            links.append('<a href="tel:' + tel + '">' + tel + '</a>')
        if directions.startswith('https://'):
            links.append('<a href="' + html_text.escape(directions) +
                         '" target="_blank" rel="noopener">Directions</a>')
        if links:
            bits.append('<p class="dps-branch-links">' + '\n'.join(links) + '</p>')
        cards.append('<article class="dps-branch-card">' + '\n'.join(bits) + '</article>')
    grid = '<div class="dps-branch-grid">\n' + '\n'.join(cards) + '\n</div>'
    m = re.search(r'<div [^>]*class="alt-component alt-component-branch-locator">', text)
    if not m:
        raise SystemExit('branches: locator component not found')
    depth, end = 1, None
    for t in re.finditer(r'<div\b|</div>', text[m.end():]):
        depth += 1 if t.group(0) == '<div' else -1
        if depth == 0:
            end = m.end() + t.end()
            break
    if end is None:
        raise SystemExit('branches: locator component never closes')
    return text[:m.start()] + grid + text[end:]


def build(capture_dir):
    capture = pathlib.Path(capture_dir)
    built = 0
    for src, route in PAGES.items():
        raw = (capture / src).read_text(encoding='utf-8', errors='replace')
        depth = len([p for p in route.split('/') if p])
        rel = '../' * depth
        text = raw

        text = strip_trackers(text)
        text = neutralize_site_config(text, rel)
        text = drop_out_of_scope(text)
        text = rewrite_urls(text, rel)
        text = unwrap_leftover_links(text)
        text = swap_logos(text, rel)
        text = inject_slots(text, route)
        text = inject_bell(text)
        if route == 'branches':
            text = inject_branches(text, capture)
        # The capture's own copy stays, but the repository rule on dashes is
        # absolute, so both dash characters become a plain hyphen.
        text = text.replace('—', '-').replace('–', '-')

        # The document identity the whole Dengage layer reads.
        text = re.sub(r'<html([^>]*)>',
                      lambda m: '<html' + re.sub(r'\s(data-demo-slug|data-rel-root|data-site-path)="[^"]*"', '', m.group(1)) +
                      ' data-demo-slug="lincoln" data-rel-root="' + rel + '" data-site-path="' +
                      ((route + '/') if route else '') + 'index.html">', text, count=1)
        page_type = 'product' if route.startswith('vehicles/') else 'other'
        product = route.split('/')[1] if route.startswith('vehicles/') else None
        body_attrs = ' data-page-type="' + page_type + '"'
        if product:
            body_attrs += ' data-product-id="' + product + '"'
        text = re.sub(r'<body([^>]*)>',
                      lambda m: '<body' + re.sub(r'\sdata-(page-type|product-id)="[^"]*"', '', m.group(1)) + body_attrs + '>',
                      text, count=1)

        # The site header the slot clearance measurement reads.
        text = re.sub(r'<(nav|header)([^>]*class=")', lambda m: '<' + m.group(1) + m.group(2) + 'site-header ', text, count=1)

        # Title says what this is.
        text = re.sub(r'<title[^>]*>.*?</title>',
                      lambda m: '<title>' + title_for(route) + '</title>', text, count=1, flags=re.S)

        head = HEAD_INJECT.format(rel=rel, stamp=STAMP)
        text = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + head, text, count=1)

        mounts = SCAFFOLD.replace('{rel}', rel) + MOUNTS.format(rel=rel, stamp=STAMP)
        if '</footer>' in text:
            text = text.replace('</footer>', FOOT_NOTE + '</footer>', 1)
        else:
            mounts = FOOT_NOTE + mounts
        text = text.replace('</body>', mounts + '</body>', 1)

        out = OUT / route / 'index.html' if route else OUT / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding='utf-8')
        built += 1

    # The captured main stylesheet references its fonts site absolutely; it
    # lives in assets/ itself, so those references become siblings.
    css = OUT / 'assets' / 'lincoln-build.css'
    if css.exists():
        body = css.read_text(encoding='utf-8', errors='replace')
        body = re.sub(r'url\((["\']?)/assets/', lambda m: 'url(' + m.group(1), body)
        body = re.sub(r'url\((["\']?)/(storage|img|css|fav)/', lambda m: 'url(' + m.group(1) + '../' + m.group(2) + '/', body)
        css.write_text(body, encoding='utf-8')
    print(f'built {built} pages, stamp {STAMP}')


def title_for(route):
    names = {
        '': 'Lincoln KSA x Dengage demo',
        'vehicles/navigator': 'Navigator', 'vehicles/aviator': 'Aviator', 'vehicles/corsair': 'Corsair',
        'forms/testdrive': 'Book a Test Drive', 'forms/quote': 'Request a Quote',
        'download-specifications': 'Download Specifications', 'offers': 'Offers',
        'offers/aviator-june-26': 'Aviator Offer', 'offers/navigator-june-26': 'Navigator Offer',
        'branches': 'Branches', 'contact-us': 'Contact Us', 'news': 'News',
        '100-years-of-lincoln': '100 Years of Lincoln', 'about-us': 'About Us',
        'privacy-policy': 'Privacy Policy', 'cookie-policy': 'Cookie Policy',
        'terms-and-conditions': 'Terms and Conditions', 'terms-of-use': 'Terms of Use',
        'submit-a-complaint': 'Submit a Complaint',
    }
    base = names.get(route, route)
    return base if route == '' else base + ' | Lincoln KSA x Dengage demo'


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else
          '/tmp/claude-0/-home-user/cdf9c424-a457-5163-9b59-ff833a4ee113/scratchpad/lincoln-capture/pages')
