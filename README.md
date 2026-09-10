# D-AUTO

A working demonstration storefront built by Dengage pre-sales, with the Dengage
customer experience platform layered in. D-AUTO is a fictitious dealership that
exists only for sales conversations: it is not a real business and sells
nothing.

Its product data is real. Vehicle names, imagery and published prices were
captured from the public Nissan Saudi Arabia website on 28 August 2026, and for
the second storefront under `/lincoln/` from the public Lincoln Saudi Arabia
website of Mohamed Yousuf Naghi Motors. Neither site is this one, D-AUTO is
affiliated with neither, and nothing a visitor does here reaches either.

```
https://d-auto.pages.dev/
```

**If you are picking this repository up for the first time, read
[HANDOVER.md](HANDOVER.md) first.** It is the whole context: what is already
done, the four things left, and what only a human can do.

## What is in this repository

| Path | What it is |
|---|---|
| `index.html`, `vehicles/`, `offers/`, `book-a-test-drive/`, `request-a-quote/`, `finance-calculator/`, `find-a-showroom/`, `shop-at-home/` | The English site |
| `dealer/` | The dealer cockpit: a simulator that feeds offline pre-purchase signals into Dengage. Not linked from the site; opened by URL during a demonstration |
| `js/` | The Dengage engagement layer: one module owns every event, identity carries DPS- contact keys, a launcher fires scenarios on demand, `?debug=1` shows every send |
| `assets/` | The captured styles, fonts and imagery, committed so the demo depends on no third-party host at runtime |
| `panel/` | Dengage panel content for this demo's campaigns, with the paste-session runbook |
| `supabase/` | SQL for the synthetic pre-purchase dataset used in the remote-data demonstration |
| `tools/` | The capture and build pipeline that produced the pages, the publish build, and the checks |
| `reference/` | The captured source material the page generators read. Tracked, because without it a clone cannot rebuild a single page |
| `dengage-webpush-sw.js` | The push service worker. It has to sit at the origin root or push never arms |
| `HANDOVER.md` | What is left to do, and everything needed to do it |

## Run it locally

```bash
python3 -m http.server 8101
# open http://localhost:8101/
```

Serve from the repository root so relative paths resolve the way they do when
published. Web push needs the published origin; everything else works locally.

## Publish it

The host is pointed at `dist/`, never at the repository root. A static host
serves whatever directory it is given, and the repository holds the panel
runbook, the demo walkthrough and the edge function sources, none of which
belong on a public URL.

```bash
python3 tools/build-dist.py     # refuses while the Dengage account is unset
cd dist && python3 -m http.server 8102
```

| Cloudflare Pages setting | Value |
|---|---|
| Build command | `python3 tools/build-dist.py` |
| Build output directory | `dist` |

Add `?debug=1` to any page URL for a live readout of every event the page
sends to Dengage, with its payload and destination table. Open the demo with
`?ck=DPS-1` to browse as one of the seeded demo contacts.

## What the forms do

There is no backend. Submitting a form does exactly one thing: it identifies
the visitor as a demo contact (a `DPS-` key) in the shared Dengage presales
application and fires the corresponding demo events. No form data goes
anywhere else, and none of it reaches Nissan. The SDK identifiers in the
pages are public by design.

## Scope

Every journey in this demonstration lives in the pre-purchase lifecycle,
from the first anonymous visit to the moment a car is sold. Ownership and
service journeys are deliberately out of scope; their links answer with a
note saying so.
