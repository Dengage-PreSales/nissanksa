# Nissan KSA x Dengage demo

A working demonstration storefront built by Dengage pre-sales on the public
Nissan Saudi Arabia website, with the Dengage customer experience platform
layered in. Pages, vehicle names, imagery and prices were captured from
nissan-saudiarabia.com on 28 August 2026 and are used solely to demonstrate
Dengage in a sales conversation with Nissan's own team. This is not Nissan's
website, it carries the Dengage logo rather than Nissan's, and nothing a
visitor does here reaches Nissan.

Live site, once GitHub Pages is enabled for this repository (deploy from
branch, `main`, root folder):

```
https://dengage-presales.github.io/nissanksa/
```

## What is in this repository

| Path | What it is |
|---|---|
| `index.html`, `vehicles/`, `offers/`, `book-a-test-drive/`, `request-a-quote/`, `finance-calculator/`, `find-a-showroom/`, `shop-at-home/` | The English site |
| `dealer/` | The dealer cockpit: a simulator that feeds offline pre-purchase signals into Dengage. Not linked from the site; opened by URL during a demonstration |
| `js/` | The Dengage engagement layer: one module owns every event, identity carries DPS- contact keys, a launcher fires scenarios on demand, `?debug=1` shows every send |
| `assets/` | The captured styles, fonts and imagery, committed so the demo depends on no third-party host at runtime |
| `panel/` | Dengage panel content for this demo's campaigns, with the paste-session runbook |
| `supabase/` | SQL for the synthetic pre-purchase dataset used in the remote-data demonstration |
| `tools/` | The capture and build pipeline that produced the pages |

## Run it locally

```bash
python3 -m http.server 8101
# open http://localhost:8101/
```

Serve from the repository root so relative paths resolve the way they do on
Pages. Web push needs the published origin; everything else works locally.

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
