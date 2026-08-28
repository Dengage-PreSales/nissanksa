#!/usr/bin/env python3
"""Delete every mirrored asset no built page references.

The mirror downloads generously (every srcset variant a captured page names);
the built pages reference a fraction of that. This walks every published HTML
file, every stylesheet and every script, collects the asset paths they use,
and removes the rest from assets/img, assets/fonts and assets/css/vendor.
Run it after tools/build-pages.py and before committing.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN_DIRS = ["assets/img", "assets/fonts", "assets/css/vendor"]


def referenced():
    keep = set()
    sources = []
    for html in ROOT.rglob("*.html"):
        if "reference" in html.parts or "node_modules" in html.parts:
            continue
        sources.append(html)
    for css in (ROOT / "assets" / "css").rglob("*.css"):
        sources.append(css)
    for js in (ROOT / "js").glob("*.js"):
        sources.append(js)
    for src in sources:
        text = src.read_text(errors="replace")
        for m in re.finditer(r"assets/(?:img|fonts|css/vendor)/[A-Za-z0-9_.-]+", text):
            keep.add(m.group(0))
    return keep


def main():
    keep = referenced()
    removed = kept = freed = 0
    for d in SCAN_DIRS:
        folder = ROOT / d
        if not folder.exists():
            continue
        for f in sorted(folder.iterdir()):
            if not f.is_file():
                continue
            rel = f.relative_to(ROOT).as_posix()
            if rel in keep:
                kept += 1
            else:
                freed += f.stat().st_size
                f.unlink()
                removed += 1
    print(f"kept {kept}, removed {removed}, freed {freed / 1048576:.1f} MB")
    total = sum(f.stat().st_size for d in SCAN_DIRS
                for f in (ROOT / d).glob("*") if f.is_file())
    print(f"assets now {total / 1048576:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
