#!/usr/bin/env python3
"""Pull the real trim data out of the captured model pages.

Their pages embed Nissan's own grade payload: the grade name, the version, the
retail price, the engine, the fuel type, a real feature list and a photograph
per trim. That is everything a configurator needs, and it means the demo can
carry one without inventing a single figure.

Nothing here fills a gap. A grade with no price is written without one, because
Number(null) is 0 and a zero riyal trim is worse than a missing line.

Run from the repository root:  python3 tools/extract-grades.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAPTURE = ROOT / 'reference' / 'hydrated'

# The capture file each model's trims come from. The three microsite models
# publish no grade payload at all, so they carry no trims rather than borrowed
# ones: a Patrol trim list on the Kicks would be a fabrication with a real name
# attached to it, which is the worst kind.
PAGES = {
    'x-trail':      'x-trail.en.html',
    'pathfinder':   'pathfinder.en.html',
    'altima':       'altima.en.html',
    'x-terra':      'x-terra.en.html',
    'patrol-pro4x': 'patrol-pro4x.en.html',
    'z':            'z.en.html',
    'magnite':      'magnite.en.html',
}


def blocks(text):
    """Each grade, and only the text that belongs to it.

    The window has to stop at the next grade rather than run a fixed length.
    An unbounded one reads the following trim's price and photograph into this
    one, which is invisible in the output and puts a real price against the
    wrong real car. Caught by two X-TRAIL trims coming out identical."""
    marks = [m for m in re.finditer(r'"gradeName"\s*:\s*"((?:[^"\\]|\\.)*)"', text)]
    for i, m in enumerate(marks):
        name = json.loads('"' + m.group(1) + '"')
        end = marks[i + 1].start() if i + 1 < len(marks) else min(len(text), m.start() + 9000)
        yield name, text[m.start():end]


def first(pattern, window, cast=str):
    m = re.search(pattern, window)
    if not m:
        return None
    try:
        return cast(m.group(1))
    except (TypeError, ValueError):
        return None


def trims(model, filename):
    path = CAPTURE / filename
    if not path.exists():
        return []
    text = html.unescape(path.read_text(encoding='utf-8', errors='ignore'))
    out, seen = [], set()
    for name, window in blocks(text):
        if name in seen:
            continue
        seen.add(name)
        price = first(r'"financialOfferPrice"\s*:\s*"([0-9.]+)"', window, float)
        specs = [json.loads('"' + s + '"') for s in
                 re.findall(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', window)[:6]]
        image = first(r'"desktopImage"\s*:\s*\{[^}]*?"source"\s*:\s*"([^"]+)"', window)
        trim = {
            'name': name,
            'version': first(r'"financialOfferVersionName"\s*:\s*"((?:[^"\\]|\\.)*)"', window),
            'power': first(r'"financialOfferPower"\s*:\s*"([^"]+)"', window),
            'fuel': first(r'"financialOfferFuelType"\s*:\s*"([^"]+)"', window),
            'specs': [s for s in specs if s.strip()],
            'image': image,
        }
        # Omitted rather than zeroed. A trim with no published price still
        # belongs in the list; a trim priced at nothing does not.
        if price:
            trim['price'] = int(price)
        out.append({k: v for k, v in trim.items() if v})
    return out


def main():
    catalogue = {}
    for model, filename in PAGES.items():
        found = trims(model, filename)
        if found:
            catalogue[model] = found
        priced = sum(1 for t in found if 'price' in t)
        print(f'{model:14s} {len(found):2d} trims, {priced} with a published price')
    out = ROOT / 'reference' / 'grades.json'
    out.write_text(json.dumps(catalogue, indent=1, ensure_ascii=False), encoding='utf-8')
    print(f'wrote {out.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
