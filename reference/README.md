# Capture material

This directory is the input to the page generators, not part of the published
site. `tools/build-pages.py` reads `hydrated/*.html` and `assets-manifest.json`;
`tools/extract-grades.py` produces `grades.json`. Without these files a fresh
clone cannot regenerate a single page, which is why they are tracked rather
than ignored.

| Path | What it is | Read by |
|---|---|---|
| `hydrated/` | The source pages as captured, scripts and trackers already removed | `tools/build-pages.py`, `tools/build-lincoln.py` |
| `assets-manifest.json` | Every downloaded asset, its source URL and its local path | `tools/build-pages.py`, `tools/download-assets.py` |
| `grades.json` | Trim and grade data lifted out of the captured pages | `tools/build-pages.py` |
| `shots/`, `local-shots/` | Screenshots of the source pages and of the built pages, kept for visual comparison | nothing at build time |

`tools/build-dist.py` never copies this directory, so none of it reaches the
published site.
