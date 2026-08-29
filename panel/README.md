# The panel session for the Nissan KSA demo

Everything the repository can do is done. What remains is panel work, about an
hour of it, and this page is the whole list, in order. The demo works without
it in one sense: the shared `dengage_demo_` campaign library already fires on
these pages. The steps below add what is Nissan-specific: the ten one-off
campaigns, the lead-events table, the journeys and the segments the Monday
story leans on.

Nothing in this repository ever deletes, truncates or edits anything that
already exists in Dengage. Every step below creates something new.

---

## 1. The lead-events table. Create it first, everything typed leans on it

The website and the dealer cockpit write pre-purchase moments that have no
column on the standard ecommerce tables (a purchase horizon, a walk-in, a
quote, a call outcome, a WhatsApp intent) to one custom Data Space table via
the SDK's own `sendDeviceEvent`, exactly the mechanism the wishlist rows have
always used. Create the event definition so those rows are stored:

- **Table name**: `ni_lead_events`
- **Columns**, all nullable text unless noted: `event_id` (text), `event_type`
  (text), `model` (text), `city` (text), `purchase_horizon` (text), `source`
  (text), `branch` (text), `note` (text), `is_used` (boolean)
- `event_type` values the pages send: `walk_in`, `test_drive_booked`,
  `test_drive_done`, `no_show`, `quote_issued`, `call_outcome`,
  `whatsapp_intent`, `vehicle_sold`, `brochure`, `finance_intent`,
  `register_interest`

**Verify against a stored row, not a green send**: open any demo page with
`?debug=1`, press a cockpit button, then read the table in Data Space. An
HTTP 200 means accepted, not stored. Until this table exists the sends are
visible in the debug readout and simply not stored, which is the expected
state, not a fault.

## 1a. Contact fields on the card: decide how typed details reach it

The web forms identify a visitor and record events. They do not send the
typed name, surname, email or phone anywhere: the Web SDK documents two
calls only, `setContactKey` and `sendDeviceEvent`, so a page cannot write
contact attributes from the browser. Two real mechanisms fill the card
instead, both on the panel side:

1. **The engine's own capture.** The `newsletter-capture` and
   `arrival-alert` campaigns store the email a visitor types through
   `Dn.postSubscription`, which creates or enriches the contact. Pasting
   section 2 turns this on with no further work.
2. **The contact API or a table import.** Names, emails and numbers arrive
   server side, the way the eight personas get theirs from the connected
   remote tables. If typed form fields should appear on the card live
   during the demo, the REST contact upsert is the mechanism; it needs an
   account API key, and the proof is a stored contact, not an accepted
   request.

The decision for this session: keep live typed contacts key only (the
personas already carry the human details the profile story needs), or
wire the contact upsert and verify it in the Sunday rehearsal. Nothing on
the website changes either way; the pages already capture everything the
chosen mechanism would need.

## 2. Ten campaigns, one paste each. Content > On-Site

Every campaign: content type **Custom HTML**, trigger **Data Layer Event**
with the exact event name below (native trigger noted where it should be used
instead), **Where to display** = `/nissanksa/`, status **Active**. The display
rule is what keeps these off every other demo sharing the application. Paste
the matching file from `panel/creatives/`.

| Event name | File | Type | Native trigger instead? |
|---|---|---|---|
| `nissan_demo_test-drive-invite` | `test-drive-invite.html` | Popup | optional: page-view frequency rule if offered |
| `nissan_demo_test-drive-rescue` | `test-drive-rescue.html` | Popup | optional: exit intent |
| `nissan_demo_finance-teaser` | `finance-teaser.html` | Sticky bar, bottom | no |
| `nissan_demo_national-day` | `national-day.html` | Popup | no |
| `nissan_demo_ramadan-offer` | `ramadan-offer.html` | Popup | no |
| `nissan_demo_tekton-launch-bar` | `tekton-launch-bar.html` | Sticky bar, top | no |
| `nissan_demo_arrival-alert` | `arrival-alert.html` | Popup, capture | no |
| `nissan_demo_newsletter-capture` | `newsletter-capture.html` | Popup, capture | no |
| `nissan_demo_comeback-offer` | `comeback-offer.html` | Popup | no |
| `nissan_demo_shopping-survey` | `shopping-survey.html` | Popup, survey | optional: scroll depth |

The creatives render in the engine's cross-origin iframe: no script tags
(the panel strips them on save), links carry `target="_top"`, imagery is
absolute URLs to the published origin, so they only look right once GitHub
Pages is live. Capture goes through the engine's own `data-dn-form-id` plus
`Dn.postSubscription()`, and the survey through `Dn.postQuestion()`.
`creatives/index.html` previews all ten from disk.

## 3. Three journeys, in priority order

1. **Booking confirmation push** (the "seconds later" moment of the run of
   show): trigger on `order_events`, one Web Push step. Copy in
   `messages.html` under Web push. This fires for website bookings and for
   the cockpit's offline booking alike, because both send the same order
   event.
2. **Abandoned booking rescue**: `beginCheckout` with no `order` within the
   wait window, Web Push step with the rescue copy. The on-site half is the
   `nissan_demo_test-drive-rescue` campaign.
3. **Welcome**: first identification, one push or inbox message.

The standing rule from the run of show: a journey unverified by the Sunday
rehearsal is shown as its canvas, plainly, never presented as a working
automation.

## 4. The purchase-horizon field and the segments

The booking form captures **Purchase Horizon** and it lands two ways: on the
order's `ni_lead_events` row (`purchase_horizon`), and nowhere else, because
columns are never added to the standard tables.

Remote data: connect the `DPS - supabase` Postgres (the same source
`dps_product` and the `hy_` tables already use) and add the four tables
below, then build the segments. Every row is synthetic and self-announcing
(DEMO VINs, 555-block mobiles, DPS- keys); the seed is deterministic, so
these counts are exact:

| Table | Rows | Holds |
|---|---|---|
| `ni_showroom_lead` | 219 | walk-ins, offline test drives, no-shows, quotes, call outcomes, WhatsApp intents |
| `ni_existing_customer` | 261 | the sample standing in for the 500K base |
| `ni_branch` | 8 | the showroom list the site's Find a Showroom page shows |
| `ni_dealer_stock` | 72 | per-branch availability; X-TRAIL is in stock at 6 of 8 branches |

Segments to build, with their exact seeded sizes:

| Segment | Filter | Size |
|---|---|---|
| Hot leads, buying within a month | `ni_showroom_lead.purchase_horizon = 'Within 1 Month'` | 45 |
| Test-drive no-shows | `stage = 'no_show'` | 12 |
| Quotes gone quiet, 14 days | `stage = 'quote_issued'` and `stage_date` older than 14 days | 30 |
| WhatsApp intents from Value First | `stage = 'whatsapp_intent'` | 19 |
| Upgrade audience | `ni_existing_customer.model_year` 2016 to 2020, model in altima, patrol, x-trail | 76 |

Two more audiences build on the standard tables rather than the remote ones,
so their size grows as the demo is used:

| Segment | Filter |
|---|---|
| Price-drop watchers | `wishlist_events` where `list_name = 'price_drop_alert'` (the Watch the price control on every model page writes it) |
| Saved-car audience | `wishlist_events` where `list_name = 'favorites'` (the hearts on the home grid) |

## 5. The eight personas

Seeded in both `ni_showroom_lead` and the dealer cockpit
(`/nissanksa/dealer/`), matched line for line. Open the demo with
`?ck=DPS-1` and the browser becomes that customer; the cockpit's persona
buttons do the same.

| Key | Story |
|---|---|
| DPS-1 | Ahmed, Riyadh. Walked into Olaya showroom, X-TRAIL quote pending, 3 web sessions. The demo's main character |
| DPS-2 | Sara, Jeddah. Asked the WhatsApp bot about PATROL financing |
| DPS-3 | Mohammed, Riyadh. Booked a test drive, never came |
| DPS-4 | Noura, Dammam. Drives a 2019 ALTIMA, browsing the new one |
| DPS-5 | Khalid, Riyadh. Buying within a month, PATROL PRO-4X |
| DPS-6 | Fatima, Makkah. Asked to be called after payday, KICKS |
| DPS-7 | Omar, Khobar. Test drive completed yesterday, X-TERRA |
| DPS-8 | Layla, Jeddah. On the TEKTON waiting list |

## 6. Verifying without opening the panel

Is the SDK serving, and are the ten campaigns live? The manifest the SDK
fetches in every visitor's browser answers from a terminal:

```bash
curl -s "https://pcdn.dengage.com/p/push/28/99d9b8fb-0c62-5a85-3e43-2402554d93a5/dengage_sdk_loader.js" | head -c 200
```

A response proves the application serves. After pasting, download the on-site
campaign manifest the loader names (grep the loader body for the `/onsite/`
path) and `grep -c nissan_demo_` it: ten means all ten are live.

Three hosts must be reachable from the machine that presents:
`pcdn.dengage.com` (widgets render), `event.dengage.com` (events store,
fails silently when blocked), `push.dengage.com` (push). `?debug=1` on any
page shows each request and its outcome, which works on a phone too.

## 7. The event dictionary: what is live today, what production defines

| Business moment | Live today, on | Production-grade definition |
|---|---|---|
| Page and model browsing | `page_view_events` via pageView | same |
| Car picked for booking | `shopping_cart_events` via addToCart | same |
| Booking form entered | `shopping_cart_events` via beginCheckout | same |
| Test drive booked, web or offline | `order_events` via order, plus `ni_lead_events` | `test_drive_bookings` fed by Web SDK and DMS |
| Saved cars | `wishlist_events` | same |
| Model search | `search_events` | same |
| Walk-in, no-show, drive done, quote, call outcome | `ni_lead_events` | `test_drive_outcomes`, `quotes` fed by DMS and telephony |
| WhatsApp intent | `ni_lead_events` (simulated feed) | Value First calling the Dengage API |
| Brochure, finance intent, register interest | `ni_lead_events` | same shape, Web SDK |
| Vehicle sold | `ni_lead_events`; exits sales journeys | DMS batch feed |

## 8. Channel coverage, one view

| Channel | State for Monday |
|---|---|
| On-site messaging, inline slots | Live once section 2 is pasted |
| Web push | Live on the published origin; worker already at the origin root |
| App inbox | Live; send from a campaign or journey, Refresh in the drawer |
| SMS, Email | Copy ready in `messages.html`; sender id needed for live sends |
| WhatsApp | Value First's channel; journey step and copy shown, live send via their WABA in production |
| RCS | Not offered. Say so if asked |
