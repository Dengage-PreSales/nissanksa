#!/usr/bin/env python3
"""Mirror the assets the captured pages reference, once, at a sensible size.

Reads reference/hydrated/*.html, downloads every stylesheet, font and image
they use from the source CDNs, compresses raster images, rewrites url(...)
references inside the stylesheets, and writes reference/assets-manifest.json
mapping each original URL to its committed local path. The build then rewrites
pages from that manifest and the published site depends on no third-party
host at runtime.

Build-time dependencies (not needed by the published site): beautifulsoup4,
pillow. Point PYTHONPATH at a directory that has them if the system python
does not.
"""
import hashlib
import io
import json
import os
import pathlib
import re
import ssl
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
HYD = ROOT / "reference" / "hydrated"
OUT_IMG = ROOT / "assets" / "img"
OUT_CSS = ROOT / "assets" / "css" / "vendor"
OUT_FONT = ROOT / "assets" / "fonts"
MANIFEST = ROOT / "reference" / "assets-manifest.json"

ALLOWED_HOSTS = (
    "libs-europe.nissan-cdn.net",
    "www-europe.nissan-cdn.net",
    "use.fontawesome.com",
    "en.nissan-saudiarabia.com",
    "www.nissan-saudiarabia.com",
    "en.allnewpatrol.nissan-saudiarabia.com",
    "en.allnewkicks.nissan-saudiarabia.com",
    # The two vehicle microsites serve their imagery from these hosts.
    "patrol-vlp.alt-test-server.com",
    "kicks-bk.alt-prod-server.com",
)

# Analytics and social hosts never become assets, whatever tag they sit in.
BLOCKED = re.compile(
    r"googletagmanager|google-analytics|doubleclick|facebook|tiktok|snapchat|"
    r"licdn|twitter|t\.co/|oracleinfinity|adobedtm|omtrdc|treasuredata|teads|"
    r"bing\.com|clarity\.ms|hotjar|krxd", re.I)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

CTX = ssl.create_default_context(
    cafile=os.environ.get("NODE_EXTRA_CA_CERTS") or None)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as res:
        return res.read()


def norm(url: str, base_host: str = "en.nissan-saudiarabia.com") -> str:
    """Normalize to a scheme-less //host/path key."""
    url = url.strip()
    if url.startswith("//"):
        return url.split("?")[0]
    if url.startswith("https://"):
        return "//" + url[len("https://"):].split("?")[0]
    if url.startswith("http://"):
        return "//" + url[len("http://"):].split("?")[0]
    if url.startswith("/"):
        return "//" + base_host + url.split("?")[0]
    if re.search(r"\.(png|jpe?g|webp|svg|gif|css|woff2?)$", url.split("?")[0], re.I) and ":" not in url:
        return "//" + base_host + "/" + url.split("?")[0]
    return ""


def wanted(key: str) -> bool:
    if not key or BLOCKED.search(key):
        return False
    host = key[2:].split("/", 1)[0]
    return host in ALLOWED_HOSTS


def ext_of(key: str, default: str) -> str:
    m = re.search(r"\.(jpe?g|png|webp|gif|svg|ico|woff2?|ttf|eot|css)$", key, re.I)
    return ("." + m.group(1).lower()) if m else default


def local_name(key: str, default_ext: str) -> str:
    stem = hashlib.sha1(key.encode()).hexdigest()[:16]
    return stem + ext_of(key, default_ext)


def compress_image(data: bytes, ext: str) -> bytes:
    if ext in (".svg", ".ico", ".gif"):
        return data
    try:
        from PIL import Image
    except ImportError:
        return data
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        return data
    if max(img.size) > 1680:
        ratio = 1680 / max(img.size)
        img = img.resize((round(img.width * ratio), round(img.height * ratio)))
    buf = io.BytesIO()
    try:
        if ext == ".png" and (img.mode in ("RGBA", "P", "LA")):
            img.save(buf, "PNG", optimize=True)
        elif ext == ".webp":
            img.save(buf, "WEBP", quality=80, method=4)
        else:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
    except Exception:
        return data
    out = buf.getvalue()
    return out if 0 < len(out) < len(data) else data


def collect_from_pages():
    from bs4 import BeautifulSoup
    css_keys, img_keys = [], []
    for page in sorted(HYD.glob("*.html")):
        host = "en.nissan-saudiarabia.com"
        if "patrol-micro" in page.name:
            host = "en.allnewpatrol.nissan-saudiarabia.com"
        if "kicks-micro" in page.name:
            host = "en.allnewkicks.nissan-saudiarabia.com"
        soup = BeautifulSoup(page.read_text(), "html.parser")
        for link in soup.find_all("link", rel=lambda v: v and "stylesheet" in v):
            key = norm(link.get("href") or "", host)
            if wanted(key) and key.endswith(".css") and key not in css_keys:
                css_keys.append(key)
        for tag in soup.find_all(["img", "source", "video"]):
            for attr in ("src", "data-src", "poster"):
                key = norm(tag.get(attr) or "", host)
                if wanted(key) and key not in img_keys:
                    img_keys.append(key)
            srcset = tag.get("srcset") or tag.get("data-srcset") or ""
            best = pick_srcset(srcset)
            if best:
                key = norm(best, host)
                if wanted(key) and key not in img_keys:
                    img_keys.append(key)
        for el in soup.find_all(style=re.compile(r"url\(")):
            for m in re.finditer(r"url\(['\"]?([^)'\"]+)", el.get("style") or ""):
                key = norm(m.group(1), host)
                if wanted(key) and key not in img_keys:
                    img_keys.append(key)
    return css_keys, img_keys


def pick_srcset(srcset: str):
    """Largest candidate up to 1680w; the page renders one size anyway."""
    best, best_w = None, -1
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        url = bits[0]
        width = 0
        if len(bits) > 1 and bits[1].endswith("w"):
            try:
                width = int(bits[1][:-1])
            except ValueError:
                width = 0
        score = width if width <= 1680 else (3400 - width)
        if score > best_w:
            best, best_w = url, score
    return best


def main():
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    OUT_CSS.mkdir(parents=True, exist_ok=True)
    OUT_FONT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())

    css_keys, img_keys = collect_from_pages()
    print(f"{len(css_keys)} stylesheets, {len(img_keys)} images referenced")

    done = 0
    for key in img_keys:
        if key in manifest:
            continue
        name = local_name(key, ".jpg")
        target = OUT_IMG / name
        if not target.exists():
            try:
                data = fetch("https:" + key)
            except Exception as err:
                print(f"  SKIP {key}: {err}")
                continue
            target.write_bytes(compress_image(data, ext_of(key, ".jpg")))
        manifest[key] = "assets/img/" + name
        done += 1
        if done % 25 == 0:
            MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True))
            print(f"  ... {done} images this run")

    for key in css_keys:
        if key in manifest:
            continue
        name = local_name(key, ".css")
        target = OUT_CSS / name
        try:
            text = fetch("https:" + key).decode("utf-8", "replace")
        except Exception as err:
            print(f"  SKIP {key}: {err}")
            continue
        base = key.rsplit("/", 1)[0]

        def swap(match):
            raw = match.group(2).strip()
            if raw.startswith("data:") or raw.startswith("#"):
                return match.group(0)
            if raw.startswith("//"):
                ref = raw.split("?")[0]
            elif raw.startswith("http"):
                ref = norm(raw)
            elif raw.startswith("/"):
                ref = "//" + key[2:].split("/", 1)[0] + raw.split("?")[0]
            else:
                parts = base
                rel = raw.split("?")[0].split("#")[0]
                while rel.startswith("../"):
                    rel = rel[3:]
                    parts = parts.rsplit("/", 1)[0]
                ref = parts + "/" + rel
            if not wanted(ref):
                return match.group(0)
            is_font = bool(re.search(r"\.(woff2?|ttf|eot)$", ref, re.I))
            folder = OUT_FONT if is_font else OUT_IMG
            rel_dir = "../../fonts/" if is_font else "../../img/"
            fname = local_name(ref, ".woff2" if is_font else ".png")
            fpath = folder / fname
            if not fpath.exists():
                try:
                    payload = fetch("https:" + ref)
                except Exception:
                    return match.group(0)
                if not is_font:
                    payload = compress_image(payload, ext_of(ref, ".png"))
                fpath.write_bytes(payload)
            manifest[ref] = ("assets/fonts/" if is_font else "assets/img/") + fname
            return "url(" + match.group(1) + rel_dir + fname + match.group(1) + ")"

        text = re.sub(r"url\((['\"]?)([^)'\"]+)\1\)", swap, text)
        target.write_text(text)
        manifest[key] = "assets/css/vendor/" + name
        print(f"  css {key.split('/')[-1][:60]} -> {name}")

    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True))
    total = sum(f.stat().st_size for d in (OUT_IMG, OUT_CSS, OUT_FONT)
                for f in d.glob("*") if f.is_file())
    print(f"manifest: {len(manifest)} entries, assets on disk {total/1048576:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
