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

## 1a. Typed lead details: the real path onto the contact card

The Web SDK documents two calls only, `setContactKey` and
`sendDeviceEvent`, so a page can never write a typed name, email or phone
onto the contact from the browser. That is the production reality too: on
a real deployment the brand's own web backend receives the form post and
calls the Dengage REST API from its servers, whose fixed egress IP is
whitelisted once. This demo runs on a static site with no backend, so it
carries a stand-in backend, and that is the one moving part below.

**The lead relay, deployed and live.** Every lead form (booking, quote,
register interest) also posts the typed details to
`https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-lead-relay`,
a Supabase Edge Function whose source is committed at
`supabase/functions/nissan-lead-relay/index.ts`. It stores each lead in
the `ni_web_lead` table (name, surname, email, mobile, model, city,
purchase horizon, consent, utm source of the visit), then upserts the
contact into `master_contact` through the documented REST calls: `POST
/rest/login` for a bearer token, `POST /rest/bulk/contacts` with
`insertIfNotExists`, permissions set from the form's own consent
checkbox. The contact key it writes is the same key the SDK is using in
that browser, so the attributes land on the exact contact the events
already belong to. Until the account side below is done, every lead is
stored with status `pending api user` and nothing is lost.

**What lands where, the relational split.** Demo owner's call, 30
August: no custom columns on `master_contact`. The relay puts identity
and reachability on the contact (name, surname, email, mobile, the
consent flag, and city, a column the contact table already carries).
The behavioral answers (preferred model, purchase horizon, title) are
deliberately not copied onto the profile: they already live on the
lead's related rows, `ni_lead_events` in Data Space and `ni_web_lead`
in Supabase, keyed to the same contact, and segmentation reaches them
through that relation. That is the relational story told on the call,
and reversing it later is a one line change in the relay plus the
matching columns on the contact table.

Two account side steps switch it on:

1. **Create an API user**: Settings > Users, the API user type, not a
   panel login. Its userkey and password become the function's secrets
   `DENGAGE_API_USERKEY` and `DENGAGE_API_PASSWORD` (Supabase dashboard >
   Edge Functions > Secrets). Rate limits to know: 30 requests per second
   per IP, and bulk upsert is meant to be called about once a minute;
   single lead calls during a demo sit far under both.
2. **Whitelist an egress IP**: Settings > Identity & Access Management >
   API IP Restriction, then Add; choose single IP or range, name the
   entry, Save, and it applies in about five minutes. The trap: Supabase
   Edge Functions have no static egress IP, stated plainly in Supabase's
   own docs and measured here on 30 August: five consecutive relay calls
   left from five different addresses, and a live push was refused by
   Dengage naming a sixth, before any credential was checked. Whitelisting
   an observed address can never hold, so the address must come from one
   of the options below. Opening the function URL in a browser (a plain
   GET) reports the address the next call would leave from and whether
   the API user secrets are visible to it, never the secret values. Three honest ways out,
   in order of preference:
   - **The chosen path: a small server with a fixed IP.** Any cheap
     Ubuntu VPS with a dedicated public IPv4 works. Run
     `tools/vps-egress-setup.sh` on it once, as root; it installs an
     authenticated CONNECT proxy, then prints the address to allowlist
     (one Add > Choose IP entry) and the `DENGAGE_EGRESS_PROXY` secret
     to set on the Supabase project. The relay picks the proxy up from
     that secret with no code change, every Dengage call then leaves
     from the server's one fixed address, and the health GET shows that
     address as `egress_ip`. TLS stays end to end: the proxy relays
     encrypted bytes it cannot read, and only to port 443. The server is
     a monthly rental; if it ever lapses the relay degrades to store
     only, and every lead still lands in `ni_web_lead`.
   - **A hosted static IP proxy** (QuotaGuard class) does the same job
     as a paid service; the same `DENGAGE_EGRESS_PROXY` secret carries
     its URL.
   - **Whitelist a provider range** only if account security accepts how
     wide that is. The relay's pool is AWS us-east-1, which spans 295
     separate blocks, over 21 million addresses, so full cover is not
     realistic. The five blocks that covered every observed call on 30
     August, each one an Add > Choose Range entry, are: 3.224.0.0 to
     3.239.255.255, 44.192.0.0 to 44.223.255.255, 100.48.0.0 to
     100.63.255.255, 18.232.0.0 to 18.235.255.255, and 13.216.0.0 to
     13.223.255.255. The pool can drift outside them; when it does, the
     lead is still stored and its `dengage_detail` names the refused
     address, which says exactly which block to add next.
   In production none of this exists: the brand's backend already has a
   fixed IP, and that is the whole integration story told to a prospect.

**Verify against a stored contact, not a 200**: submit a form on the
published site, then read the row in `ni_web_lead` (its `dengage_status`
says exactly what the API answered) and open the contact in Audience.

**Where the automation starts.** Nothing extra is needed for journeys:
the booking journey triggers on the order event (section 3), and segment
entry does the rest. Two more REST doors exist when they are wanted:
`POST /rest/dataspace/triggerAutomatedFlow` starts a flow that carries an
API trigger step, and the transactional send endpoints (email, SMS, push)
cover messages whose trigger lives outside Dengage. Same login, same IP
rules.

The two supporting mechanisms are unchanged:

- **The engine's own capture.** The `newsletter-capture` and
  `arrival-alert` campaigns store the typed email through
  `Dn.postSubscription`; pasting section 2 turns this on.
- **The persona import: already done, over the API.** On 30 August the
  `nissan-persona-seed` function (source committed beside the relay)
  upserted DPS-1 to DPS-8 with name, surname, email, mobile, city and
  consent, and read DPS-1 back stored. It is idempotent, so a POST to
  it re-asserts the eight any time. `panel/personas.csv` remains the
  same eight rows in the account's import template columns, kept as
  the manual Audience alternative.

## 2. Ten campaigns, one paste each. Content > On-Site

Every campaign: content type **Custom HTML**, trigger **Data Layer Event**
with the exact event name below (native trigger noted where it should be used
instead), **Where to display** = `/nissanksa/`, status **Active**. The display
rule is what keeps these off every other demo sharing the application. Paste
the matching file from `panel/creatives/`.

| Event name | File | Type | Native trigger instead? |
|---|---|---|---|
| `nissan_demo_test-drive-invite` | `test-drive-invite.html` | Popup | optional: page-view frequency rule if offered |
| `nissan_demo_test-drive-rescue` | `test-drive-rescue.html` | Popup | CHOSEN: exit intent. The launcher card shows the gesture; move the pointer out of the top of the window to fire it |
| `nissan_demo_finance-teaser` | `finance-teaser.html` | Sticky bar, bottom | no |
| `nissan_demo_national-day` | `national-day.html` | Popup | no |
| `nissan_demo_ramadan-offer` | `ramadan-offer.html` | Popup | no |
| `nissan_demo_tekton-launch-bar` | `tekton-launch-bar.html` | Sticky bar, top | no |
| `nissan_demo_arrival-alert` | `arrival-alert.html` | Popup, capture | no |
| `nissan_demo_newsletter-capture` | `newsletter-capture.html` | Popup, capture | no |
| `nissan_demo_comeback-offer` | `comeback-offer.html` | Popup | no |
| `nissan_demo_shopping-survey` | `shopping-survey.html` | Popup, survey | CHOSEN: scroll depth. The launcher card shows the gesture; scroll down the page to fire it |

**Paste each file WHOLE**, doctype to closing tag: every file now carries
its own panel settings in a comment at the top, including layout and width.
Two Design settings are not style choices: **padding 0** and a
**transparent background**, or the engine draws its own white box around
the card. Popups take the engine's close button via Layout > Close Button >
Add close button to outside.

The creatives render in the engine's cross-origin iframe: no script tags
(the panel strips them on save), links carry `target="_top"`, imagery is
absolute URLs to the published origin, so they only look right once GitHub
Pages is live. The two capture files and the survey are built on the
engine's native form contract: the SDK arms its handler only when the
stored content contains the exact text `data-dn-form-id="subscription_form"`
(or `question_form` for the survey), fields carry `data-dn-id` with
`data-dn-type`, and the engine stamps `data-dn-is-submitted="true"` on
`.container` when the post succeeds. Verify a capture against a stored
contact, not a closed popup. `creatives/index.html` previews all ten from
disk.

## 3. Three journeys, in priority order

1. **Booking confirmation push** (the "seconds later" moment of the run of
   show): trigger on `order_events`, one Web Push step. Copy in
   `CONTENT.md`, built in the push composer, never as HTML. This fires for website bookings and for
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

The booking form captures **Purchase Horizon** and it lands two ways: on
the order's `ni_lead_events` row (`purchase_horizon`) and on the lead's
`ni_web_lead` row, both keyed to the contact. It is deliberately not
copied onto the contact itself: segmentation reaches it through the
relation, the demo owner's call of 30 August. Columns are never added to
the six standard event tables.

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
| Typed lead details: name, email, phone, consent | lead relay upserts `master_contact` over REST, once the API user in section 1a exists | the brand's web backend calling the same contact API from its own fixed IP |

## 7a. Parked: model aware popups

Parked on 29 August, demo owner's call, revisit after Monday. The popups
can follow the visitor's model two ways: display rule variants per vehicle
path (cheap, page based), or Dynamic Content template tag creatives reading the
visitor's history and a product table per contact, the way the shared
ecommerce abandoned cart card already does on this account. The plan when
picked up: an `ni_product` remote table seeded from the committed imagery,
one flagship dynamic creative built against the factory's dynamic content
playbook, display rule variants for the static ones. Not part of the
Monday scope.

## 8. Channel coverage, one view

| Channel | State for Monday |
|---|---|
| On-site messaging, inline slots | Live once section 2 is pasted |
| Web push | Live on the published origin; worker already at the origin root |
| App inbox | Live; send from a campaign or journey, Refresh in the drawer |
| SMS, Email | Composer field sheets in `CONTENT.md`; sender id needed for live sends |
| WhatsApp | Value First's channel; journey step and copy shown, live send via their WABA in production |
| RCS | Not offered. Say so if asked |

## 9. The Lincoln demo rides on all of the above unchanged

Added 30 August. A second storefront lives in this repository at
`https://dengage-presales.github.io/nissanksa/lincoln/`, a replica of the
Lincoln Saudi Arabia distributor site (Mohamed Yousuf Naghi Motors), built for
its own meeting. It needs nothing from the panel, because everything in
sections 1 to 8 already covers it:

- **Same application, same display rules.** Lincoln pages sit under
  `/nissanksa/`, so every campaign whose display rule matches that path serves
  there too. Verified live on 30 August: firing `nissan_demo_test-drive-invite`
  on a Lincoln page fetched and drew the campaign with zero panel edits.
- **Same tables, same journeys.** The Lincoln booking funnel writes the same
  rows: `page_view_events`, `shopping_cart_events`, `order_events` (order ids
  `DPS-lincoln-td-<n>`), `ni_lead_events`, and typed leads reach
  `master_contact` through the same relay. A journey on any of those reacts to
  Lincoln traffic exactly as it does to Nissan traffic.
- **Same personas.** The `DPS-1` to `DPS-8` contacts serve both demos; the
  Lincoln dealer cockpit reuses them with Lincoln model context.
- **Two launcher cards are Nissan only** and are deliberately absent from the
  Lincoln launcher: `tekton-launch-bar` and `arrival-alert` carry Nissan model
  copy. Everything else in the launcher is shared.
- **Known trade-offs, stated on the call if asked:** the web push and campaign
  click targets configured in the panel point at Nissan demo URLs, and the
  campaign creatives carry the shared automotive styling rather than Lincoln's
  palette. Both are panel content choices, not platform limits; a production
  account per brand would carry its own.
- **Branch data on the Lincoln branches page** is baked in from the
  distributor's public dealer feed at build time, so the page is self
  contained like everything else in the demo.

## 10. Before a call: check the browser's notification permission

Found 31 August while testing with a real click. When a browser has
notifications **blocked** for `dengage-presales.github.io`, the Dengage SDK
opens its blocked-push panel over the page on every load: a full window
modal, "Catch price drops and new offers", with a close control. It is
dismissible and then gone for that page, but it lands on top of whatever is
being shown.

This is SDK behaviour driven by the browser's permission state, not
something in the demo, and it affects the Nissan and Lincoln demos alike. It
appears only when the permission is blocked; a browser that has never been
asked, or that allowed push, never sees it.

Before presenting, open the padlock beside the address bar and set
Notifications for this site to Allow or Ask. A browser that was used to test
push and answered Block is exactly the case that shows the panel.

## 11. Lincoln: the experiences the demo draws, and the booking confirmation

Added 31 August, and this section is the one to read before a Lincoln call.

### The eight Lincoln scenarios are page creatives, not campaigns

The `nissan_demo_` campaigns carry Nissan model copy, so a Lincoln audience
cannot be shown them, and rewriting them in the panel would change what the
Nissan demo shows. The Lincoln launcher's eight cards therefore render from
`lincoln/js/creatives.js` in the site's own palette, and none of them raises a
`nissan_demo_` data layer event. A Nissan campaign can never answer one of
these cards, whether those campaigns are paused or live.

The thirteen cards under On-site messaging are unchanged: they are the shared
`dengage_demo_` library, brand neutral by design, and still served live from
Dengage. That is where the on-site engine itself is demonstrated.

### They fire on behaviour, not on a button

Each creative carries a rule, so a visitor meets it by browsing:

| Creative | When it appears by itself |
|---|---|
| Test drive invite | On a model page, after two models seen this session and 18 seconds of dwell |
| Test drive rescue | Exit intent on the booking page, once typing has started |
| Shopping survey | 60 percent scroll depth on a model or offers page |
| Finance teaser | A model or offers page, 30 seconds in, once Finance was chosen anywhere |
| National Day | 9 seconds on the offers page |
| Seasonal offer | The offers page, after National Day has been seen |
| Welcome back | The home page on a second visit |
| Newsletter | 45 percent scroll or 20 seconds, home or article pages, only while the visitor is unidentified, once per visitor |

Three guards keep them civil: one on screen at a time, 25 seconds between
automatic appearances, and once per session for each rule. Every launcher card
still fires its creative on demand, twice in a row, which is what a presenter
needs mid call.

### A booking confirms itself three ways

1. **On-site**, immediately: a card repeating back exactly what was typed,
   model, name, mobile, email, city, showroom, horizon and payment. Nothing is
   invented and an empty field is left out.
2. **Email**, through `POST /rest/transactional/email` with content
   `2206f32b-8d1a-4058-929c-de600493862a`.
3. **Push**, through `POST /rest/transactional/push` with content
   `91edd42b-2e43-4e61-a8d5-88bf5a5688af`.

The sends live in the `nissan-booking-confirm` function, separate from the
lead relay on purpose: the lead path must never fail, so a refused send costs
the booking nothing. Every outcome is written onto the lead's row in
`ni_web_lead` as `tx_email_status`, `tx_push_status` and `tx_detail`, so the
question "did it actually go" is answered by the record.

**The parameters the content can address by name**, all taken from the form:
`name`, `surname`, `email`, `gsm`, `model`, `city`, `branch`,
`purchase_horizon`.

Two things this needed on the account side, both now done: the API user
carries permission for the transactional API (without it both calls answer
403 with an empty body), and the push needs a device token, so a browser that
has not allowed notifications answers `Token not found with given ContactKey`.
The confirmation card offers the permission for exactly that reason: allow it
and the same confirmation arrives as a notification seconds later.

## 12. The ten moments that can message, and what each still needs

Added 31 August. The demo can ask Dengage for a transactional email and push
at any of these moments. Booking is live; the rest send nothing until their
content exists in the panel, and say so rather than failing quietly. Check the
current state at any time by opening the function URL in a browser:
`.../functions/v1/nissan-booking-confirm` lists every moment and whether its
content is configured.

**The content itself is written and waiting in [`lincoln/`](lincoln/README.md):**
one email body per moment as a file to paste, the push title, message, target
URL and media for all ten in [`lincoln/PUSH.md`](lincoln/PUSH.md), and the
table that says which content id goes in which variable. Nothing needs
composing from scratch.

| Moment | Fires when | State |
|---|---|---|
| `booking` | A test drive form is submitted | **Live**, email and push |
| `abandoned_booking` | The booking page is left after an address was typed and before submit | Needs content |
| `quote` | The quote form is submitted | Needs content |
| `brochure` | A specification sheet is downloaded by a known visitor | Needs content |
| `newsletter` | The newsletter card is completed | Needs content |
| `survey` | The on-site survey is answered | Needs content |
| `showroom_visit` | The cockpit logs a walk in | Needs content |
| `test_drive_done` | The cockpit logs a completed drive | Needs content |
| `no_show` | The cockpit logs a no-show | **Live**, push |
| `inbox_message` | Asked for on demand, to fill the inbox drawer during a call | **Live**, push |

**To turn one on**, author the email and the push in the panel and give both
public ids. They are read from these names, so nothing in the code changes:
`DENGAGE_TX_EMAIL_ABANDONED`, `DENGAGE_TX_PUSH_ABANDONED`,
`DENGAGE_TX_EMAIL_QUOTE`, `DENGAGE_TX_PUSH_QUOTE`,
`DENGAGE_TX_EMAIL_BROCHURE`, `DENGAGE_TX_PUSH_BROCHURE`,
`DENGAGE_TX_EMAIL_NEWSLETTER`, `DENGAGE_TX_PUSH_NEWSLETTER`,
`DENGAGE_TX_EMAIL_SURVEY`, `DENGAGE_TX_PUSH_SURVEY`,
`DENGAGE_TX_EMAIL_WALKIN`, `DENGAGE_TX_PUSH_WALKIN`,
`DENGAGE_TX_EMAIL_TD_DONE`, `DENGAGE_TX_PUSH_TD_DONE`,
`DENGAGE_TX_EMAIL_NOSHOW`, `DENGAGE_TX_PUSH_NOSHOW`,
`DENGAGE_TX_PUSH_INBOX`.

### What every message can personalize on

Sent as `current` on both channels, and as `customParameters` on the push, so
content built either way resolves. Everything here is either typed by the
visitor or taken from the source site; the site publishes no prices, so no
price is offered.

`first_name`, `full_name`, `name`, `surname`, `email`, `gsm`, `city`,
`branch`, `purchase_horizon`, `booking_ref`, `model`, `model_id`,
`model_seats`, `model_category`, `model_url`, `model_image`, `booking_url`.

**Four of them are sent every time**, whatever the moment and whatever the
visitor has told us: `model`, `model_url`, `model_image` and `booking_url`.
With no car in play the brand name stands in for the model and the links point
at the range, so a push title, a target URL and the media field can each use
the bare tag. Those three fields carry no condition, and an empty value there
leaves a hole a visitor sees before anything else. Everything else is optional
and is printed only inside `{% if (...) { %} ... {% } %}`, because a city or a
showroom has no honest stand in.

So the same booking content says Navigator, seats up to 8 and shows the
Navigator photograph to one visitor, and Corsair, seats up to 5 to the next.
Verified live on 31 August: an Aviator booking sent both channels with the
Aviator values.

### Two things that decide whether a push lands

The push carries no inline text: every word comes from the saved content, so
personalization is only ever through the parameters above. And Dengage holds
the device token against whichever contact key claimed it last, so a push
addressed to an older key answers `no device subscribed for this contact`.
The live flow always addresses the key that just acted, which is why it lands.

## 13. Two things to know about the push image, and about pushing to a persona

Found on 31 August while testing the no-show push on a Mac.

**The image.** A rich push wants a 2:1 image, and neither of two things works:
a portrait crop, or AVIF, which no notification or mail client decodes. The
demo now sends the source site's own model banner, 1440 by 720, JPEG, under
200KB, so the same value serves the push and the email hero.

**Where the image will and will not appear.** The panel says it plainly under
Web Settings: Media, Icon and Badge are not supported in macOS Safari, and a
notification on macOS shows as a plain system banner with text only in Chrome
too, because macOS draws it rather than the browser. So the image is worth
showing on Windows Chrome or on Android, and a Mac is the wrong machine to
prove it on. The text personalization works everywhere: the no-show push on a
Mac read "The Corsair is still here whenever you are", from
`{%= $Current.model %}`.

**Pushing to a persona from the cockpit.** Dengage holds a device token
against whichever contact key claimed it last, and the seeded personas
DPS-1 to DPS-8 have no device of their own, so a cockpit signal for DPS-1
answers `no device subscribed for this contact` rather than reaching anything.
To show an offline signal arriving as a notification, open the storefront as
that persona first:

    https://dengage-presales.github.io/nissanksa/lincoln/?ck=DPS-1

allow notifications, and the browser is then DPS-1's device. Fire the walk in,
the completed drive or the no-show from the cockpit for DPS-1 and it lands on
that machine. The cockpit log prints what Dengage answered either way.
