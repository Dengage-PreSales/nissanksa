#!/usr/bin/env python3
"""Turn the captured Nissan KSA pages into the published demo pages.

Reads reference/hydrated/*.html and reference/assets-manifest.json, and emits
the site's pages at the repository root. Per page: strip every script and
tracker, remove the furniture a static demo cannot honour (cookie banner,
My Showroom, corporate news), rewrite every asset to its committed local copy,
contain every link inside the demo, swap the Nissan logo for the Dengage one,
stamp the metadata the engagement layer reads, inject the Dengage mounts and
the five inline slots, and add the footer notice that this is a demonstration.

Build-time dependency: beautifulsoup4 (PYTHONPATH points at it).
"""
import json
import pathlib
import re
import shutil
import sys
import time

from bs4 import BeautifulSoup, NavigableString

ROOT = pathlib.Path(__file__).resolve().parent.parent
HYD = ROOT / "reference" / "hydrated"
MANIFEST = json.loads((ROOT / "reference" / "assets-manifest.json").read_text())

# ---------------------------------------------------------------------------
# The page map: capture -> published path, with the stamps each page carries.

PAGES = {
    "index.html":                     {"src": "home.en",              "type": "home",      "title": "Nissan KSA x Dengage demo"},
    "vehicles/x-trail/index.html":    {"src": "x-trail.en",           "type": "product",   "product": "x-trail",      "title": "X-TRAIL"},
    "vehicles/pathfinder/index.html": {"src": "pathfinder.en",        "type": "product",   "product": "pathfinder",   "title": "PATHFINDER"},
    "vehicles/altima/index.html":     {"src": "altima.en",            "type": "product",   "product": "altima",       "title": "ALTIMA"},
    "vehicles/x-terra/index.html":    {"src": "x-terra.en",           "type": "product",   "product": "x-terra",      "title": "X-TERRA"},
    "vehicles/z/index.html":          {"src": "z.en",                 "type": "product",   "product": "z",            "title": "Z"},
    "vehicles/patrol-pro4x/index.html": {"src": "patrol-pro4x.en",    "type": "product",   "product": "patrol-pro4x", "title": "PATROL PRO-4X"},
    "vehicles/magnite/index.html":    {"src": "home.en",              "type": "product",   "product": "magnite",      "title": "MAGNITE", "authored": "magnite"},
    "vehicles/patrol/index.html":     {"src": "patrol-micro.en",      "type": "product",   "product": "patrol",       "title": "PATROL", "micro": True, "host": "en.allnewpatrol.nissan-saudiarabia.com"},
    "vehicles/kicks/index.html":      {"src": "kicks-micro.en",       "type": "product",   "product": "kicks",        "title": "KICKS", "micro": True, "host": "en.allnewkicks.nissan-saudiarabia.com"},
    "vehicles/tekton/index.html":     {"src": "tekton-register.en",   "type": "product",   "product": "tekton",       "title": "TEKTON, register your interest"},
    "book-a-test-drive/index.html":   {"src": "test-drive.en",        "type": "other",     "title": "Book a Test Drive"},
    "request-a-quote/index.html":     {"src": "quote.en",             "type": "other",     "title": "Get an Online Quote"},
    "offers/index.html":              {"src": "offers.en",            "type": "promotion", "title": "Latest Offers"},
    "offers/x-trail-999/index.html":  {"src": "offer-x-trail-999.en", "type": "promotion", "promotion": "x-trail-999",    "title": "X-TRAIL offer"},
    "offers/kicks-august/index.html": {"src": "offer-kicks-aug.en",   "type": "promotion", "promotion": "kicks-august",   "title": "KICKS offer"},
    "offers/magnite-august/index.html": {"src": "offer-magnite-aug.en", "type": "promotion", "promotion": "magnite-august", "title": "MAGNITE offer"},
    "finance-calculator/index.html":  {"src": "finance-calculator.en", "type": "other",    "title": "Finance Calculator"},
    "find-a-showroom/index.html":     {"src": "showroom.en",          "type": "other",     "title": "Find a Showroom"},
    "shop-at-home/index.html":        {"src": "shop-at-home.en",      "type": "other",     "title": "Shop@Home"},
}

# Exact internal routes: the source site's href -> this demo's path.
ROUTES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/vehicles/new/x-trail.html": "vehicles/x-trail/index.html",
    "/vehicles/new/pathfinder.html": "vehicles/pathfinder/index.html",
    "/vehicles/new/altima.html": "vehicles/altima/index.html",
    "/vehicles/new/x-terra.html": "vehicles/x-terra/index.html",
    "/vehicles/new/Z.html": "vehicles/z/index.html",
    "/vehicles/new/z.html": "vehicles/z/index.html",
    "/vehicles/new/patrol-pro4x.html": "vehicles/patrol-pro4x/index.html",
    "/vehicles/new/all-new-magnite.html": "vehicles/magnite/index.html",
    "/vehicles/new/tekton/register-interest.html": "vehicles/tekton/index.html",
    "/book-a-test-drive.html": "book-a-test-drive/index.html",
    "/request-a-quote.html": "request-a-quote/index.html",
    "/latest-offers.html": "offers/index.html",
    "/vehicles/offers/x-trail-999-june-2026-offer.html": "offers/x-trail-999/index.html",
    "/vehicles/offers/kicks-august-2026-offer.html": "offers/kicks-august/index.html",
    "/vehicles/offers/magnite-august-2026-offer.html": "offers/magnite-august/index.html",
    "/finance-calculator.html": "finance-calculator/index.html",
    "/find-a-showroom.html": "find-a-showroom/index.html",
    "/dealer-finder.html": "find-a-showroom/index.html",
    "/authorized-service-centers.html": "find-a-showroom/index.html",
    "/shop-at-home.html": "shop-at-home/index.html",
    "/cars-for-sale/inventory/buy.shtml": "shop-at-home/index.html",
    "/contact-us.html": "request-a-quote/index.html",
    # Three Shop@Home actions the source site sends elsewhere. Without these
    # they fall through to the home page, which answers none of them: a visitor
    # who asked to be called back is the pre-purchase moment this whole demo is
    # about, and landing them on a banner loses it.
    "/new-car-inventory.html": "shop-at-home/index.html#start",
    "/services/contact-us.html": "request-a-quote/index.html",
    "/customer-service/contact-us.html": "request-a-quote/index.html",
    "/nissan-fleet.html": "request-a-quote/index.html",
    "/nissan-fleet/contact-fleet-sales.html": "request-a-quote/index.html",
}

# The three vehicle microsites, linked absolutely from the home grid.
MICRO = {
    "en.allnewpatrol.nissan-saudiarabia.com": "vehicles/patrol/index.html",
    "en.allnewkicks.nissan-saudiarabia.com": "vehicles/kicks/index.html",
    "en.patrolnismo.nissan-saudiarabia.com": "vehicles/patrol/index.html",
}

# Anything matching these goes to the named page: close content this demo
# holds, rather than a dead end.
ALIAS = [
    (re.compile(r"^/(compare|find-your-nissan|my-showroom)"), "index.html#models"),
    (re.compile(r"^/vehicles/(configure|brochures|test-drive-videos|nismo-vehicles)"), "index.html#models"),
    (re.compile(r"^/vehicles/offers/"), "offers/index.html"),
    (re.compile(r"^/vehicles/"), "index.html#models"),
    (re.compile(r"^/(experience-nissan|news-events|formula-e|search-results)"), "index.html"),
    (re.compile(r"^/(corporate|global-sites|careers)"), "index.html"),
]

# Ownership and after-sales pages are a later phase: the link stays visible
# and honest, and js/site.js answers it with the pre-purchase scope note.
POSTSALE = re.compile(r"^/(owners|services/book-a-service|nissan-rescue|privacy|cookies|terms|legal|sitemap|recall)")

TRACKER = re.compile(
    r"googletagmanager|google-analytics|doubleclick|facebook|tiktok|snapchat|"
    r"licdn|linkedin|twitter|oracleinfinity|adobedtm|omtrdc|treasuredata|teads|"
    r"bing\.com|clarity|hotjar|krxd|bat\.js|analytics", re.I)

# Pages caches assets for ten minutes; a fresh stamp per build makes every
# page pull the demo layer that matches it, so a fix is live on one refresh.
STAMP = str(int(time.time()))


def _wa_glyph():
    svg = (ROOT / "assets" / "brand" / "whatsapp.svg").read_text()
    svg = svg.replace("<svg ", '<svg width="30" height="30" aria-hidden="true" ', 1)
    return svg.replace("<path ", '<path fill="currentColor" ', 1)


WA_GLYPH = _wa_glyph()

DENGAGE_LOGO = """<span class="dps-brand" aria-label="Dengage Auto Demo">
<svg viewBox="0 0 38 38" role="img" aria-hidden="true"><path fill="currentColor" d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/><path fill="currentColor" d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/></svg>
<span class="dps-brand-text"><b>DENGAGE</b><i>Auto Demo</i></span></span>"""


def rel_root(out_path: str) -> str:
    depth = out_path.count("/")
    return "../" * depth


def norm_href(href: str) -> str:
    href = (href or "").strip()
    for host in ("https://en.nissan-saudiarabia.com", "https://www.nissan-saudiarabia.com",
                 "http://en.nissan-saudiarabia.com"):
        if href.startswith(host):
            href = href[len(host):] or "/"
    return href


def map_route(href: str, rel: str):
    """Return the demo href for a captured link, or None to leave it alone."""
    raw = norm_href(href)
    if raw.startswith("#") or raw.startswith("mailto:") or raw.startswith("tel:"):
        return None
    for host, target in MICRO.items():
        if host in raw:
            return rel + target
    if raw.startswith("javascript"):
        return None
    if not raw.startswith("/"):
        if raw.startswith("http"):
            return "POSTSALE" if False else rel + "index.html"
        return None
    path = raw.split("#")[0].split("?")[0]
    frag = raw[len(path):]
    # The source pages carry campaign tokens and internal record ids in the
    # query and the fragment. They mean nothing here and read as debris in the
    # address bar on a shared screen, so only a plain anchor survives.
    if not re.fullmatch(r"#[A-Za-z][\w-]*", frag or "#a"):
        frag = ""
    if path in ROUTES:
        return rel + ROUTES[path] + frag
    if POSTSALE.match(path):
        return "POSTSALE"
    for rx, target in ALIAS:
        if rx.match(path):
            return rel + target
    return rel + "index.html"


def asset_local(url: str, rel: str, host: str = "en.nissan-saudiarabia.com"):
    key = url.strip()
    if key and not key.startswith(("http", "//", "/", "data:", "#")) and re.search(r"\.(png|jpe?g|webp|svg|gif|css|woff2?)$", key.split("?")[0], re.I):
        key = "/" + key
    if key.startswith("https://"):
        key = "//" + key[len("https://"):]
    elif key.startswith("http://"):
        key = "//" + key[len("http://"):]
    elif key.startswith("/") and not key.startswith("//"):
        key = "//" + host + key
    key = key.split("?")[0]
    hit = MANIFEST.get(key)
    return (rel + hit) if hit else None


def pick_srcset(srcset: str):
    best, best_w = None, -1
    for part in (srcset or "").split(","):
        bits = part.strip().split()
        if not bits:
            continue
        width = 0
        if len(bits) > 1 and bits[1].endswith("w"):
            try:
                width = int(bits[1][:-1])
            except ValueError:
                width = 0
        score = width if width <= 1680 else (3400 - width)
        if score > best_w:
            best, best_w = bits[0], score
    return best


# ---------------------------------------------------------------------------
# Transform passes


def strip_scripts(soup):
    for tag in soup.find_all(["script", "noscript"]):
        tag.decompose()
    # A captured page keeps no embedded frames at all: the hydrate pass brings
    # along live third party widgets (reCAPTCHA, audience pixels) that a demo
    # must not load at runtime.
    for tag in soup.find_all("iframe"):
        src = tag.get("src") or ""
        if not src or src.startswith(("http://", "https://", "//")) or TRACKER.search(src):
            tag.decompose()
    for tag in soup.find_all("link"):
        rels = " ".join(tag.get("rel") or [])
        if rels in ("", None) or re.search(r"preload|preconnect|dns-prefetch|prefetch|canonical|alternate|manifest|apple|icon|shortcut", rels, re.I):
            tag.decompose()
    for tag in soup.find_all("img"):
        if TRACKER.search(tag.get("src") or ""):
            tag.decompose()
    for tag in soup.find_all("meta"):
        if tag.get("http-equiv") or (tag.get("name") or "").startswith(("google", "fb", "twitter")):
            tag.decompose()


def strip_furniture(soup):
    # Cookie banner: the crawl rejected consent; the demo asks for none.
    for el in soup.select(".c_128, .cookies-container, [class*=cookie-full-bleed]"):
        el.decompose()
    # My Showroom is the source site's personalisation locker; the demo's
    # personalisation is Dengage's, so the locker and its heart go.
    for a in soup.select('a[href*="my-showroom"]'):
        holder = a.find_parent("li") or a
        holder.decompose()
    # Corporate news does not belong to a pre-purchase demo: the heading row
    # goes, and so does every following sibling row that is news cards or the
    # VIEW ALL button under them.
    for h in soup.find_all(string=re.compile(r"LATEST FROM NISSAN", re.I)):
        row = h.find_parent("div", class_="grid-row") or h.find_parent("div", class_="heliostext")
        if not row:
            continue
        trailing = []
        sib = row.find_next_sibling()
        while sib is not None:
            text = sib.get_text(" ", strip=True) if hasattr(sib, "get_text") else ""
            if re.search(r"READ MORE|VIEW ALL", text, re.I) and len(text) < 1200:
                trailing.append(sib)
                sib = sib.find_next_sibling()
            else:
                break
        for el in trailing:
            el.decompose()
        row.decompose()
    # The forms travelled with their live reCAPTCHA, a third party gate this
    # demo cannot honour and must not load: the whole apparatus goes, and the
    # demo's own submit handling answers instead.
    for el in soup.select(
            ".captcha-validation, [id^='captcha-widget'], .g-recaptcha-response, "
            "input.captcha-token, .g-recaptcha-bubble-arrow, .grecaptcha-badge"):
        el.decompose()
    # The Tekton secondary navigation is a script driven accordion; captured
    # without its script, its collapsed label paints across the header brand,
    # and its one real link duplicates the page itself.
    for el in soup.select(".c_010D-secondary-nav"):
        el.decompose()
    # The Patrol microsite's mobile burger opened a drawer that only existed
    # in script; the header's Book a Test Drive and Buy Now stay and work.
    for el in soup.select(".burgerMenu"):
        el.decompose()
    # The Kicks page repeats its reserve pill as an unstyled floating link
    # that lands on top of the styled row carrying the same destination.
    for a in list(soup.find_all("a")):
        if not a.get("class") and a.get_text(strip=True).lower() == "reserve now":
            a.decompose()
    # The Kicks sticky bottom bar was a script driven menu; captured without
    # its script, its collapsed overlay paints over the hero pills that
    # already carry every one of its destinations.
    for el in soup.select(".StickyBottomNav"):
        el.decompose()
    # The source site's WhatsApp floater stays visible, because the channel is
    # part of this demo's story, but it answers with the partnership note
    # instead of opening Nissan's real line. Its icon font never shipped with
    # the capture, so the glyph is inlined from the committed SVG.
    for a in soup.select("a.whatsapp-button, a[href*='api.whatsapp.com'], a[href*='wa.me']"):
        a["href"] = "#"
        a["data-demo-dead"] = "whatsapp"
        a["aria-label"] = "WhatsApp"
        a.clear()
        frag = BeautifulSoup(WA_GLYPH, "html.parser").find("svg")
        if frag:
            a.append(frag)
    # No Arabic mirror is built yet, so the language switch would dead-end.
    for a in soup.select("a[href*='ar.nissan-saudiarabia.com']"):
        holder = a.find_parent("li") or a
        holder.decompose()
    # The header search posts to a results page this demo answers in place.
    for f in soup.select("form.search"):
        f["data-demo-search"] = "1"
        if f.has_attr("action"):
            del f["action"]


def rewrite_assets(soup, rel, host="en.nissan-saudiarabia.com"):
    for tag in soup.find_all(["img", "source", "video", "audio"]):
        srcset = tag.get("srcset") or tag.get("data-srcset")
        if srcset:
            best = pick_srcset(srcset)
            local = asset_local(best, rel, host) if best else None
            for attr in ("srcset", "data-srcset", "sizes", "data-sizes"):
                if tag.has_attr(attr):
                    del tag[attr]
            if local and tag.name == "img":
                tag["src"] = local
            elif local and tag.name == "source":
                tag["srcset"] = local
        for attr in ("src", "data-src", "poster"):
            val = tag.get(attr)
            if not val:
                continue
            local = asset_local(val, rel, host)
            if local:
                if attr == "data-src":
                    tag["src"] = local
                    del tag["data-src"]
                else:
                    tag[attr] = local
            elif attr == "src" and val.startswith(("http", "//")):
                # An asset the mirror does not hold never phones home.
                del tag[attr]
    # A video with no player script shows its poster; one without a poster
    # would be a black stage, so it leaves and its poster image stands in.
    for vid in soup.find_all("video"):
        poster = vid.get("poster")
        if poster:
            img = soup.new_tag("img", src=poster, alt="")
            img["class"] = "dps-video-poster"
            vid.replace_with(img)
        else:
            vid.decompose()
    for el in soup.find_all(style=re.compile(r"url\(")):
        style = el.get("style") or ""

        def swap(m):
            local = asset_local(m.group(2), rel, host)
            return f"url({m.group(1)}{local}{m.group(1)})" if local else "none"

        el["style"] = re.sub(r"url\((['\"]?)([^)'\"]+)\1\)", swap, style)


def collect_css(soup, rel, host="en.nissan-saudiarabia.com"):
    """The page's own stylesheets, mapped local, in source order."""
    seen, links = set(), []
    for link in soup.find_all("link", rel=lambda v: v and "stylesheet" in v):
        local = asset_local(link.get("href") or "", rel, host)
        media = link.get("media") or ""
        if local and local not in seen:
            seen.add(local)
            media_attr = f' media="{media}"' if media and media != "print" else ""
            if media == "print":
                continue
            links.append(f'<link rel="stylesheet" href="{local}"{media_attr}>')
        link.decompose()
    for st in soup.find_all("style"):
        st.decompose()
    return "\n".join(links)


def rewrite_links(soup, rel):
    for a in soup.find_all("a", href=True):
        target = map_route(a["href"], rel)
        if target == "POSTSALE":
            a["href"] = "#"
            a["data-demo-dead"] = "postsale"
        elif target:
            a["href"] = target
        for attr in ("target", "ping"):
            if a.has_attr(attr):
                del a[attr]


def swap_logo(soup, rel):
    done = 0

    def is_logo(url):
        return bool(re.search(r"nissan-next-logo|NN_NIM_logo|nissan[-_]?logo|logo-text", url or "", re.I))

    # The header logo is a <picture> of brand sources; the footer's is an img.
    for pic in soup.find_all("picture"):
        srcs = [s.get("srcset") or s.get("src") or "" for s in pic.find_all(["source", "img"])]
        if any(is_logo(s) for s in srcs) or "logo" in " ".join(pic.get("class") or []):
            pic.replace_with(BeautifulSoup(DENGAGE_LOGO, "html.parser"))
            done += 1
    for img in soup.find_all("img"):
        if is_logo(img.get("src")):
            img.replace_with(BeautifulSoup(DENGAGE_LOGO, "html.parser"))
            done += 1
    # A logo container left empty still gets the mark.
    for a in soup.select("a.logo-container"):
        if not a.select_one(".dps-brand") and not a.find("img"):
            a.append(BeautifulSoup(DENGAGE_LOGO, "html.parser"))
            done += 1
    # Home link behind the logo goes to the demo home.
    for holder in soup.select(".dps-brand"):
        a = holder.find_parent("a")
        if a:
            a["href"] = rel + "index.html"
            a["aria-label"] = "Dengage Auto Demo home"
    return done


def add_hearts(soup):
    """A save control per model card, feeding the real wishlist events."""
    grid = soup.select_one(".vehiclelisting")
    if not grid:
        return
    seen = set()
    for a in grid.find_all("a", href=True):
        href = a["href"]
        model = None
        m = re.search(r"vehicles/([a-z0-9-]+)/index\.html", href)
        if m:
            model = m.group(1)
        if not model or model in seen:
            continue
        seen.add(model)
        card = a
        for _ in range(5):
            if card.parent and card.parent.find(re.compile("^h[2-6]$")):
                card = card.parent
                break
            card = card.parent or card
        if card.select_one(".dps-heart"):
            continue
        btn = soup.new_tag("button", type="button")
        btn["class"] = "dps-heart"
        btn["data-save-car"] = model
        btn["aria-label"] = "Save this car"
        btn.append(BeautifulSoup(
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-10-9.2C.4 8.6 2 5 5.5 5c2 0 3.4 1.1 4.2 2.4L12 10l2.3-2.6C15.1 6.1 16.5 5 18.5 5 22 5 23.6 8.6 22 11.8 19.5 16.3 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
            "html.parser"))
        card.insert(0, btn)
        if not card.get("style") or "position" not in (card.get("style") or ""):
            card["style"] = (card.get("style") or "") + ";position:relative;"


SLOT_IDS = {
    "below_header": "dn_inline_target_below_header",
    "below_hero": "dn_inline_target_below_hero",
    "in_grid": "dn_inline_target_in_grid",
    "pdp_below_price": "dn_inline_target_pdp_below_price",
    "above_footer": "dn_inline_target_above_footer",
}


def slot(soup, slot_id):
    div = soup.new_tag("div", id=slot_id)
    div["class"] = "dn-inline-slot"
    return div


def inject_slots(soup, spec):
    body = soup.body
    header = soup.select_one("header")
    if header:
        header.insert_after(slot(soup, SLOT_IDS["below_header"]))
    hero = soup.select_one(".c_007_v2") or soup.select_one("main section, main div")
    if hero:
        hero.insert_after(slot(soup, SLOT_IDS["below_hero"]))
    grid = soup.select_one(".vehiclelisting")
    if grid:
        grid.append(slot(soup, SLOT_IDS["in_grid"]))
    if spec.get("type") == "product":
        anchor = soup.select_one(".vehiclelisting") or hero
        if anchor:
            anchor.insert_after(slot(soup, SLOT_IDS["pdp_below_price"]))
    footer = soup.select_one("footer")
    if footer:
        footer.insert_before(slot(soup, SLOT_IDS["above_footer"]))
    elif body:
        body.append(slot(soup, SLOT_IDS["above_footer"]))


OFFER_CARDS = [
    {"src": "offer-x-trail-999.en", "out": "offers/x-trail-999/index.html", "model": "X-TRAIL",
     "hero_hint": ("x-trail-999", "999")},
    {"src": "offer-kicks-aug.en", "out": "offers/kicks-august/index.html", "model": "KICKS",
     "hero_hint": ("kicks-august", "kicks_")},
    {"src": "offer-magnite-aug.en", "out": "offers/magnite-august/index.html", "model": "MAGNITE",
     "hero_hint": ("magnite-august", "magnite_")},
]


def offer_summary(src_name, hero_hint=()):
    """Title line and hero image of a captured offer page, its own words. The
    hero is the campaign's own banner, matched by its asset name."""
    page = HYD / f"{src_name}.html"
    if not page.exists():
        return None, None
    sub = BeautifulSoup(page.read_text(), "html.parser")
    title = None
    for hd in sub.find_all(["h1", "h2"]):
        text = hd.get_text(" ", strip=True)
        if 6 < len(text) < 90:
            title = text
            break
    candidates = []
    for img in sub.find_all("img"):
        src = img.get("src") or ""
        if "www-europe.nissan-cdn.net" in src or src.startswith("//www-europe"):
            candidates.append(src)
    hero = None
    for hint in hero_hint:
        for src in candidates:
            if hint in src:
                hero = src
                break
        if hero:
            break
    if not hero and candidates:
        hero = candidates[0]
    return title, hero


def replace_offers_listing(soup, rel):
    """Their live offers module reads an API and shows '0 Matching Offers'.
    The demo's hub lists the site's own three current campaign pages, and the
    inline slot beside them is where Dengage personalizes the page."""
    # The source module is two components: the filter sidebar (c_195) and
    # the API-driven results pane (c_194). Both leave; the grid stands where
    # the results stood.
    anchor = None
    for el in soup.select(".c_194-0, .offersContainer"):
        if anchor is None:
            anchor = soup.new_tag("div")
            el.replace_with(anchor)
        else:
            el.decompose()
    for el in soup.select(".c_195-0, .offer-filters"):
        el.decompose()
    cards = []
    for card in OFFER_CARDS:
        title, hero = offer_summary(card["src"], card.get("hero_hint", ()))
        if not title:
            continue
        local = asset_local(hero, rel) if hero else None
        img_tag = f'<img src="{local}" alt="">' if local else ""
        cards.append(
            f'<a class="dps-offer-card" href="{rel}{card["out"]}">{img_tag}'
            f'<span class="dps-offer-model">{card["model"]}</span>'
            f'<span class="dps-offer-title">{title}</span>'
            f'<span class="dps-offer-cta">View offer</span></a>')
    grid = BeautifulSoup(
        '<section class="dps-offers"><h1 class="dps-offers-title">Current offers</h1>'
        '<div class="dps-offers-grid">'
        + "".join(cards) + "</div></section>", "html.parser")
    if anchor:
        anchor.replace_with(grid)
    else:
        main = soup.find("main") or soup.body
        main.insert(0, grid)


MAGNITE_MAIN = """
<main class="dps-mini-pdp">
  <section class="mini-hero">
    <img src="{rel}assets/img/a3b81f83b4369a8f.jpg" alt="Nissan MAGNITE">
  </section>
  <section class="mini-head">
    <p class="mini-kicker">ALL-NEW NISSAN</p>
    <h1>MAGNITE</h1>
    <p class="mini-tag">The Smarter Choice</p>
    <p class="mini-price">Starting Price <strong>SAR 69,999</strong></p>
    <div class="mini-ctas">
      <a class="mini-btn solid" href="{rel}book-a-test-drive/index.html?model=magnite">BOOK A TEST DRIVE</a>
      <a class="mini-btn" href="{rel}request-a-quote/index.html">GET AN ONLINE QUOTE</a>
      <a class="mini-btn" href="{rel}offers/magnite-august/index.html">VIEW THE AUGUST OFFER</a>
      <button type="button" class="mini-btn" data-mini-brochure="magnite">DOWNLOAD BROCHURE</button>
    </div>
  </section>
  <section class="mini-gallery">
    <img src="{rel}assets/img/side-magnite.jpg" alt="Nissan MAGNITE side view">
    <img src="{rel}assets/img/78d0c9cf038dd5b9.jpg" alt="Nissan MAGNITE August offer">
  </section>
</main>
"""


def author_magnite(soup, rel):
    """The source MAGNITE page renders entirely in the browser, so a capture
    holds nothing to repair. This page is authored instead: the home page
    lends its header, footer and styles, and the content carries only what
    the source site itself publishes, its imagery, its price, its tagline."""
    header = soup.select_one("header")
    footer = soup.select_one("footer")
    body = soup.body
    if header and footer:
        head_chain = [header] + list(header.parents)
        lca = None
        for node in [footer] + list(footer.parents):
            if node in head_chain:
                lca = node
                break
        if lca is not None:
            def branch_of(el):
                node = el
                while node is not None and node.parent is not lca:
                    node = node.parent
                return node
            keep = {branch_of(header), branch_of(footer)}
            for child in list(lca.find_all(recursive=False)):
                if child not in keep:
                    child.extract()
    # Belt and braces: whatever survived the walk, no home component may
    # remain outside the header and footer.
    for el in soup.select(".c_007_v2, .vehiclelisting, .heliostext, .c_001, .c_005, .c_012, .c_030, .c_304, .c_238_v2"):
        if el.find_parent("header") is None and el.find_parent("footer") is None:
            el.extract()
    main = BeautifulSoup(MAGNITE_MAIN.format(rel=rel), "html.parser")
    if header:
        header.insert_after(main)
    else:
        body.insert(0, main)


BRANCHES = [
    ("Olaya Showroom", "Riyadh", "Showroom"),
    ("Exit 5 Showroom", "Riyadh", "Showroom"),
    ("Madinah Road Showroom", "Jeddah", "Showroom"),
    ("Corniche Showroom", "Jeddah", "Showroom"),
    ("King Fahd Road Showroom", "Dammam", "Showroom"),
    ("Khobar Showroom", "Khobar", "Showroom"),
    ("Makkah Showroom", "Makkah", "Showroom"),
    ("Madinah Showroom", "Madinah", "Showroom"),
]


def replace_showroom(soup, rel):
    """The source page hosts a scripted dealer locator that arrives as a dead
    grey pane. An authored directory stands in: the same eight sample branches
    the ni_branch dataset seeds, each with a real map link, plus the QR that
    demonstrates offline capture: scanning it opens this demo tagged with its
    showroom source, so the visit lands attributed."""
    dead = None
    for el in soup.select("[class*=dealer-locator], [class*=locator], [class*=map]"):
        if el.find_parent("header") is None and el.find_parent("footer") is None:
            dead = dead or el
    cards = "".join(
        f'<div class="dps-branch"><b>{name}</b><span>{city} · Petromin Nissan network</span>'
        f'<a href="https://www.google.com/maps/search/?api=1&query={("Petromin Nissan " + city).replace(" ", "+")}"'
        f' target="_blank" rel="noopener">Get directions</a></div>'
        for name, city, _ in BRANCHES)
    block = BeautifulSoup(
        '<section class="dps-branches"><div class="dps-branches-inner">'
        '<h2>Showrooms</h2><p class="dps-branches-note">Sample branches for this '
        'demonstration; each is a row in the dealer table the CDP holds.</p>'
        f'<div class="dps-branch-grid">{cards}</div>'
        '<div class="dps-qr"><img src="' + rel + 'assets/brand/showroom-qr.svg" alt="QR code opening this demo tagged showroom-qr">'
        '<div><b>The QR at the stand</b><p>Scanning it opens this site tagged '
        '<code>showroom-qr</code>, so the walk-in becomes an attributed, targetable '
        'visit the moment their phone opens the page. Print it on a stand, a desk, '
        'a windscreen card.</p></div></div>'
        '</div></section>', "html.parser")
    if dead is not None:
        target = dead
        for _ in range(4):
            parent = target.parent
            if parent is not None and parent.name not in ("main", "body") and len(parent.find_all(recursive=False)) == 1:
                target = parent
            else:
                break
        target.replace_with(block)
    else:
        (soup.find("main") or soup.body).insert(0, block)


def replace_finance_calculator(soup):
    """The source calculator is scripted upstream and arrives dead; a working
    one (drawn by js/site.js into #dps-finance) stands where it stood."""
    for el in soup.select(".c_309"):
        el.decompose()
    for el in soup.select(".finance-calculator, .financeSummary, .finance-summary"):
        holder = el
        for _ in range(3):
            parent = holder.parent
            if (parent is not None and parent.name not in ("main", "body")
                    and len(parent.find_all(recursive=False)) == 1):
                holder = parent
            else:
                break
        holder.decompose()
    h1 = soup.find("h1")
    host = soup.new_tag("div", id="dps-finance")
    anchor = h1.find_parent("div") if h1 else None
    if anchor:
        anchor.insert_after(host)
    elif soup.main:
        soup.main.insert(0, host)
    else:
        soup.body.insert(0, host)


def strip_dashes(soup):
    """House style for everything published: no em or en dashes. Captured
    copy gets the same treatment so the whole site reads one way."""
    for node in soup.find_all(string=re.compile(r"[\u2013\u2014]")):
        node.replace_with(str(node).replace("\u2013", "-").replace("\u2014", "-"))


def footer_notice(soup):
    note = BeautifulSoup(
        '<div class="dps-notice">A demonstration storefront built by Dengage for a '
        'sales conversation. Vehicle names, imagery and prices come from the public '
        'Nissan Saudi Arabia website; this is not Nissan’s site and no data here '
        'reaches Nissan.</div>', "html.parser")
    footer = soup.select_one("footer")
    (footer or soup.body).append(note)


def head_block(spec, rel, css_links):
    title = spec["title"]
    if spec.get("type") != "home":
        title = f"{title} | Nissan KSA x Dengage demo"
    return f"""<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="A Dengage demonstration built on the public Nissan Saudi Arabia website.">
<meta name="robots" content="noindex">
<link rel="icon" type="image/svg+xml" href="{rel}assets/brand/favicon.svg">
<meta name="theme-color" content="#111111">

<!-- ORDER IN THE HEAD IS LOAD BEARING. identity.js resolves the contact key
     synchronously and must run before the SDK snippet initializes; both must
     run before any stylesheet, because a pending stylesheet blocks every
     script after it and a blocked corporate network must never be able to
     stop the SDK from starting. -->
<script src="{rel}js/identity.js?v={STAMP}"></script>
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

{css_links}
<link rel="stylesheet" href="{rel}assets/css/override.css?v={STAMP}">
<link rel="stylesheet" href="{rel}assets/css/demo-controls.css?v={STAMP}">"""


def mounts_block(rel):
    scripts = "\n".join(
        f'<script src="{rel}js/{f}.js?v={STAMP}"></script>'
        for f in ["config", "copy", "vehicles", "dengageEvents", "site",
                  "creatives", "panels", "slots", "inbox", "debug"])
    return f"""
<!-- ==================== Dengage demo layer ==================== -->
<div class="scrim" id="scrim"></div>

<aside class="dps-drawer" id="inbox" aria-label="Nissan KSA updates">
  <div class="dps-drawer-head dps-modal-head">
    <h2>Nissan KSA updates</h2>
    <span id="inbox-count" hidden></span>
    <button type="button" id="inbox-refresh">Refresh</button>
    <button type="button" class="dps-x" data-close="1" aria-label="Close">&times;</button>
  </div>
  <div class="dps-drawer-body" id="inbox-body"></div>
</aside>

<div class="dps-modal" id="test-drive" role="dialog" aria-modal="true"></div>

<div class="dps-modal" id="dengage-panel" role="dialog" aria-label="Dengage">
  <div class="dps-modal-head">
    <h2>Dengage</h2>
    <button type="button" class="dps-x" data-close="1" aria-label="Close">&times;</button>
  </div>
  <div class="dps-modal-body">
    <p class="dps-note">Fire any experience on this page, live. Everything lands in the Dengage panel as it happens.</p>
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
  <button type="button" class="dps-bell" data-open="#inbox" aria-label="Nissan KSA updates">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4a5 5 0 0 1 5 5v4l1.7 2.6H5.3L7 13V9a5 5 0 0 1 5-5z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
    <span class="dps-badge" id="inbox-badge" hidden>0</span>
  </button>
  <button type="button" class="dps-launch" data-open="#dengage-panel" aria-label="Dengage demo">
    <svg viewBox="0 0 38 38"><path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/><path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/></svg>
  </button>
</div>

{scripts}
"""


SIDE_SHOTS = {
    "side-magnite.jpg": "Cars-Side-Shots/MAGNITE.jpg",
    "side-kicks.jpg": "Cars-Side-Shots/ALL-NEW-KICKS.jpg",
    "side-x-trail.jpg": "Cars-Side-Shots/ALL-NEW-X-TRAIL.jpg",
    "side-x-terra.jpg": "Cars-Side-Shots/2022%20%20x-terra-side.jpg",
    "side-pathfinder.jpg": "Cars-Side-Shots/PATHFINDER-2022.jpg",
    "side-patrol.webp": "Cars-Side-Shots/ALL-NEW-PATROL.webp",
    "side-patrol-pro4x.jpg": "Cars-Side-Shots/PATROL-PRO-4X.jpg",
    "side-patrol-nismo.jpg": "Cars-Side-Shots/NEW-PATROL-NISMO.jpg",
    "side-altima.webp": "Cars-Side-Shots/NEW-ALTIMA.webp",
    "side-z.webp": "Cars-Side-Shots/NISSAN-Z.webp",
}


def stable_side_shots():
    """The catalogue references committed, stable filenames."""
    for name, tail in SIDE_SHOTS.items():
        hit = None
        for key, local in MANIFEST.items():
            if key.endswith(tail.split("/")[-1]) or tail.split("/")[-1] in key:
                hit = local
                break
        if hit:
            src = ROOT / hit
            dst = ROOT / "assets" / "img" / name
            if src.exists() and not dst.exists():
                shutil.copyfile(src, dst)
        else:
            print(f"  side shot missing for {name}")


def build(out_path: str, spec: dict):
    src = HYD / f"{spec['src']}.html"
    if not src.exists():
        print(f"SKIP {out_path}: no capture {spec['src']}")
        return False
    rel = rel_root(out_path)
    soup = BeautifulSoup(src.read_text(), "html.parser")

    strip_scripts(soup)
    strip_furniture(soup)
    if out_path == "finance-calculator/index.html":
        replace_finance_calculator(soup)
    if out_path == "offers/index.html":
        replace_offers_listing(soup, rel)
    if out_path == "find-a-showroom/index.html":
        replace_showroom(soup, rel)
    if spec.get("authored") == "magnite":
        author_magnite(soup, rel)
    host = spec.get("host", "en.nissan-saudiarabia.com")
    swapped = swap_logo(soup, rel)
    css_links = collect_css(soup, rel, host)
    rewrite_assets(soup, rel, host)
    rewrite_links(soup, rel)
    if out_path == "index.html":
        add_hearts(soup)
    inject_slots(soup, spec)
    strip_dashes(soup)
    footer_notice(soup)

    html = soup.find("html")
    body = soup.body
    body_attrs = " ".join(
        f'{k}="{" ".join(v) if isinstance(v, list) else v}"'
        for k, v in (body.attrs or {}).items() if k != "style")
    stamps = [f'data-page-type="{spec["type"]}"']
    if spec.get("product"):
        import_price = None
        stamps.append(f'data-product-id="{spec["product"]}"')
        prices = {"magnite": 69999, "kicks": 89599, "x-trail": 104999,
                  "x-terra": 118999, "pathfinder": 164999, "patrol": 270999,
                  "patrol-pro4x": 380999, "altima": 112700, "z": 261999}
        if spec["product"] in prices:
            stamps.append(f'data-price="{prices[spec["product"]]}"')
        cat = "Sedan" if spec["product"] == "altima" else ("Sports" if spec["product"] == "z" else "SUV")
        stamps.append(f'data-category-path="Vehicles>{cat}"')
    if spec.get("promotion"):
        stamps.append(f'data-promotion-id="{spec["promotion"]}"')
    if spec.get("micro"):
        stamps.append('data-micro="1"')

    inner = body.decode_contents()
    doc = f"""<!DOCTYPE html>
<html lang="en" dir="ltr" data-demo-slug="nissanksa" data-rel-root="{rel}" data-site-path="{out_path}">
<head>
{head_block(spec, rel, css_links)}
</head>
<body {body_attrs} {' '.join(stamps)}>
{inner}
{mounts_block(rel)}
</body>
</html>
"""
    # House style, applied to the final document so escaped attribute values
    # are covered too: no em or en dashes anywhere published.
    doc = doc.replace("\u2013", "-").replace("\u2014", "-")
    out = ROOT / out_path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)
    print(f"built {out_path}  ({len(doc)//1024} KB, logo swaps {swapped})")
    return True


def main():
    only = sys.argv[1:]
    stable_side_shots()
    ok = 0
    for out_path, spec in PAGES.items():
        if only and not any(o in out_path for o in only):
            continue
        if build(out_path, spec):
            ok += 1
    print(f"{ok} pages built")


if __name__ == "__main__":
    main()
