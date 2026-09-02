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
  `register_interest`, `survey_response`, `configure`, `reserve`, `compare`,
  `chooser`

`configure` and `reserve` arrived with the build and reserve page on
1 September. `configure` carries the grade a visitor chose in `note`, which is
the most valuable thing an automotive site ever learns about someone: it names
the price they talked themselves into. `reserve` carries the same grade plus
the showroom they picked.

`compare` and `chooser` arrived with the three profile pages the same day.
`compare` names the models put side by side, which is what turns a browser into
a shortlist. **`chooser` is the one to build a segment on first:** the third
question on Find your Nissan is when they are buying, so the row carries a
`purchase_horizon` for a visitor nobody has named yet. That is the hot leads
field, asked before any form has their details.

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

## 2. Ten campaigns. Optional since 1 September, and here is why

**Read this before spending an hour on it.** The Nissan storefront now draws
these ten experiences itself, from `js/creatives.js`, exactly as the Lincoln
storefront has since 31 August. Every launcher card works, twice in a row, with
nothing configured in the panel, and each creative also appears on its own from
a browsing rule rather than only from a button. So the demo is complete without
this section.

What pasting them into the panel adds is a different claim on the call: the
same experience arriving from Dengage rather than from the site. It is worth
doing if the audience wants to see the on-site engine control the message, and
it changes nothing about the story if it is skipped.

**If you do paste them, switch the demo over with `?onsite=panel`.** Add it to
any demo URL and the ten brand cards raise their `nissan_demo_` event for the
engine to answer, the demo's own browsing rules stand down so nobody sees the
same message twice, and each launcher card prints the campaign name it fires.
`?onsite=local` puts it back. The choice is remembered for that browser, so it
survives a click through to a model page and a presenter sets it once before
a call.

It is a switch rather than a race on purpose: firing both and letting whichever
answers first win would mean nobody could say, on a call, where the popup on
screen came from. The one exception is the booking confirmation, which is drawn
either way. It answers a form the visitor just submitted rather than a trigger,
and no panel content draws it.

The thirteen cards under On-site messaging are a separate matter and are not
optional in the same way: they are the shared `dengage_demo_` library, already
live, and they are where the on-site engine itself is demonstrated.

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

### 4a. The remote data source: what to connect, and the one thing that silently breaks it

Dengage reads this data over a direct Postgres connection, so it needs a login
of its own. **Data Space > Remote Data Sources > New**, type PostgreSQL:

| Field | Value |
|---|---|
| Host | `db.raextqlludkagdntyzwn.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| Schema | `public` |
| User | `dengage_reader` |
| Password | sent separately. It is deliberately not in this repository, which is public |
| SSL | required |

If the panel cannot open a direct connection outbound, use the pooler instead:
host `aws-0-ap-northeast-1.pooler.supabase.com`, port `6543`, user
`dengage_reader.raextqlludkagdntyzwn`, same password. The database is in
`ap-northeast-1`.

`dengage_reader` was created for this and can do nothing else: select on the
five `ni_` tables and the eight views below, no insert, no update, no delete,
no `ni_inbox`. That was verified as the role rather than assumed. It is defined
in `supabase/schema.sql`, without the password.

**The failure worth knowing about in advance**, because it does not look like a
failure. These tables have row level security enabled and had no policies. A
role reading a table in that state does not get an error: it connects fine,
authenticates fine, and every query returns zero rows. A remote source wired
this way tests green and every segment built on it is empty. The policies now
exist, one read-only policy per table, so this is fixed; it is written down
because the next table added here will have the same trap and the same silence.

### 4b. Eight views, so a segment is one filter rather than a join

The panel builds segments over a single remote table at a time, so the joins
live in the database and the panel sees flat tables. Counts are as of the
seeding and are exact unless noted.

| View | Rows | What it is, and the segment it makes |
|---|---|---|
| `v_ni_contact_360` | 508 | One row per person the demo knows anything about, web and showroom and owner base merged on the contact key. `known_both_sides` is the composable CDP claim made checkable: it is true only where the same person exists on both sides. Today that is DPS-1, by design, and it grows every time a persona fills in a form on the site. `last_web_site` scopes a segment to `nissan` or `lincoln` |
| `v_ni_hot_leads` | 72 | Buying within a month, from whichever side of the business said so. This is the segment the run of show opens in the panel. The equivalent filter on `ni_showroom_lead` alone is 45: the view is larger because it also counts people whose horizon came from the website form |
| `v_ni_no_show` | 12 | Booked a test drive, did not arrive, and has not been driven or sold to since. The re-invite journey reads this one |
| `v_ni_quote_open` | 43 | Quotes that never became a sale, with `days_since_quote` so the segment picks its own quiet period. 32 of them are older than 14 days today, and that number moves with the calendar |
| `v_ni_upgrade_candidates` | 228 | Owners three years in or more: the pre-purchase moment for their next car. This is the 500K story, made queryable. The narrower 2016 to 2020 Altima, Patrol and X-TRAIL cut is 76 |
| `v_ni_stock_gap` | 11 | Model and branch combinations with nothing on the ground. **Not connectable**: it is about places and cars, so it has no contact key. Read it in the panel or in SQL, and use `v_ni_contact_stock` for the segment |
| `v_ni_contact_stock` | 214 | The stock fact, per person: their car, their branch, whether it is there, and which branch has it if not. 40 want what their branch does not have |
| `v_ni_dealer_leads` | 216 | Every lead with its showroom attached, for the dealer-scoped segments a sub-account would own. Three of the 219 leads have no branch and are correctly absent: they came in over WhatsApp before any showroom was involved |

The five base tables are readable too, and remain the right source for anything
the views do not cover:

| Table | Rows | Holds |
|---|---|---|
| `ni_showroom_lead` | 219 | walk-ins, offline test drives, no-shows, quotes, call outcomes, WhatsApp intents |
| `ni_existing_customer` | 261 | the sample standing in for the 500K base |
| `ni_branch` | 8 | the showroom list the site's Find a Showroom page shows |
| `ni_dealer_stock` | 72 | per-branch availability; X-TRAIL is in stock at 6 of 8 branches |
| `ni_web_lead` | grows | every lead the website itself captured, with its UTM source. Starts small on purpose: it fills up during the demo |

### The rule that decides what can be a remote table at all

**A remote table has to relate to `master_contact` or `master_device`.**
Established on 2 September by the demo owner, from the panel. It is the single
most important thing on this page, because it rules out three things this
document previously told you to connect, and it does so silently: a table with
no contact key is simply not offered.

Every row in a remote table therefore needs a contact key. That splits what
this demo holds into two piles:

| Connect these, every row has a contact key | Do not try to connect these |
|---|---|
| `ni_showroom_lead`, `ni_existing_customer`, `ni_web_lead` | `ni_branch`, `ni_dealer_stock` |
| `v_ni_contact_360`, `v_ni_hot_leads`, `v_ni_no_show`, `v_ni_quote_open`, `v_ni_upgrade_candidates`, `v_ni_dealer_leads`, `v_ni_contact_stock` | `v_ni_stock_gap` |

The right hand column is reference data: a branch list and a stock table are
about places and cars, not people, so they were never going to relate to a
contact. They are still real and still used, by the demo's own Find a Showroom
page and by the view below.

**I got this wrong first, and the wrong fix is still in the schema.** When
`ni_dealer_stock` would not connect I read it as a key shape problem, because it
is also the only one of the five whose primary key is three columns, and added
`stock_id` to give it a single column key. That was a fix for a diagnosis that
was not the fault. The column is harmless and stays; it fixes nothing.

**What carries the stock story instead: `v_ni_contact_stock`.** One row per
person who has told a showroom which car they want, saying whether that car is
on the ground where they were dealt with, and naming the branch that has it if
it is not. 214 contacts, of whom **40 want a car their branch does not have, and
all 40 have a branch named**. That is a better segment than the stock table ever
was: a campaign that says a car is unavailable is an apology, and one that says
where it is waiting is an appointment.

Named filters worth having ready, since they are the ones the story asks for:

| Segment | Source | Filter | Size |
|---|---|---|---|
| Hot leads, buying within a month | `v_ni_hot_leads` | none, the view is the segment | 72 |
| Test-drive no-shows | `v_ni_no_show` | none | 12 |
| Quotes gone quiet, 14 days | `v_ni_quote_open` | `days_since_quote >= 14` | 32 |
| WhatsApp intents from Value First | `ni_showroom_lead` | `stage = 'whatsapp_intent'` | 19 |
| Upgrade audience | `v_ni_upgrade_candidates` | `years_owned >= 5` for the 2016 to 2020 cut | 76 |
| Known on both sides | `v_ni_contact_360` | `known_both_sides = true` | 1 today, and rising during the demo |
| Dealer scoped, Olaya | `v_ni_dealer_leads` | `branch_name` = the branch | per branch |
| Wants a car their branch does not have | `v_ni_contact_stock` | `in_stock_for_them = false` | 40 |

Two more audiences build on the standard ecommerce tables rather than the
remote ones, so their size grows as the demo is used:

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

Two documents sit alongside this one. [VERIFY.md](VERIFY.md) checks each item
here is wired, in about twenty five minutes. [WALKTHROUGH.md](WALKTHROUGH.md)
walks one buyer from a Google ad click to a car sold in fifty two steps, which
is the one to rehearse before a call.


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

## 7. The event dictionary: every call, and the table it lands in

Verified against stored rows on 1 September, not against an HTTP 200. A full
journey was walked on the published site and every table counted before and
after: twenty eight rows sent, twenty eight rows stored, no table short. The
counts endpoint in section 7b is how that check is repeated.

| Business moment | The call | Table |
|---|---|---|
| Every page, before anything else | `pageView` | `page_view_events` |
| A car picked, on the form or the configurator | `ec:addToCart` | `shopping_cart_events` |
| **The car swapped for another** | `ec:removeFromCart` | `shopping_cart_events` |
| **A build dropped from My Showroom** | `ec:deleteCart` | `shopping_cart_events` |
| Details entered, booking or reservation | `ec:beginCheckout` | `shopping_cart_events` |
| Test drive booked, or a build reserved | `ec:order` | `order_events`, `order_events_detail` |
| **A booking called off** | `ec:cancelOrder` | `order_events`, `order_events_detail` |
| Saved cars and price watches | `ec:addToWishlist`, `ec:removeFromWishlist` | `wishlist_events` |
| Model search | `ec:search` | `search_events` |
| Everything with no column on a standard table | `sendDeviceEvent` | `ni_lead_events` |

The four in bold arrived on 1 September. `removeFromCart` was the one that
mattered: Dengage rebuilds a cart from its event stream, so changing the model
or the grade used to send a second `addToCart` with nothing between it and the
first, and the cart read as a visitor holding two cars.

**Every `event_type` in `ni_lead_events`**, which is the one custom table:

| Type | Raised when |
|---|---|
| `walk_in`, `test_drive_booked`, `test_drive_done`, `no_show`, `test_drive_cancelled` | the showroom side, from the cockpit |
| `quote_issued`, `call_outcome`, `whatsapp_intent`, `vehicle_sold` | the rest of the offline feed |
| `brochure`, `finance_intent`, `register_interest`, `survey_response` | the website's own moments |
| `configure`, `reserve` | a grade chosen, and a build held. `note` carries the grade |
| `compare` | models put side by side. `note` names them |
| `chooser` | Find your Nissan answered. **Carries `purchase_horizon`** |
| `creative_shown`, `creative_action` | an on site experience met, and acted on. `source` separates a rule from the launcher |

Typed lead details are the exception to all of this: name, email, phone and
consent cannot be written from a page, so the lead relay upserts them onto
`master_contact` over REST. Section 1a has the detail.

## 7b. Verifying the whole thing

[VERIFY.md](VERIFY.md) is the runbook: one sitting, about twenty five minutes,
ending with every item either proved or named as not done. It covers the
storefront in one pass, the anonymous and known paths, and each panel item with
a way to check it that does not involve trusting a green tick in a form.

The console it runs on is at
<https://dengage-presales.github.io/nissanksa/verify/>. It reads which moments
can message and whether events are landing, and it writes nothing. It also
loads no part of the demo on purpose, because a verification tool that fires
its own page view appears in the numbers it reports.

## 7c. Proving a row landed, without opening the panel

An HTTP 200 from the event endpoint means accepted and nothing more. The only
proof is the row, and this reads the counts:

    curl -s https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-dengage-tables

Run it, use the demo, run it again. Two things worth knowing before you trust
the answer. **Storage lags by roughly two minutes**, measured on 1 September, so
a reading taken straight after a click shows nothing and means nothing. And the
account is shared, so a count that moved is not proof it was your event, while a
count that did not move is proof it was not.

The endpoint reads and never writes. It has no code path that drops or
truncates anything and it accepts no table name from the caller: the seven it
reads are fixed in its source at `supabase/functions/nissan-dengage-tables/`.

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
| App inbox | Live, two sources: the demo's own message centre answers every moment instantly, and campaigns or journeys deliver into Dengage's inbox beside it |
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

## 12. The moments that can message, on both demos

Added 31 August. Either demo asks Dengage for a transactional email and a push
at these moments. One function serves both and tells them apart by the brand
each page sends, so the reply names it back.

**The push contents are shared.** That copy names no dealer, so one content
serves both demos and only the values change: the model, its figure, its page
and its photograph. The newsletter is the single exception, because its copy
names the dealer it welcomes you to, and the function holds it back for Nissan
rather than sending the wrong dealer's words.

**The email bodies are never shared.** An email carries a dealer name and a
footer. Lincoln's ten are authored and live; Nissan's seven are written and
waiting in [`nissan/`](nissan/README.md), and until their ids are set the
Nissan side reports `needs content` and sends nothing.

Two other differences follow from the source sites rather than from choice.
Lincoln publishes seat counts and no prices, so its messages carry seats;
Nissan publishes starting prices and no seat counts, so its messages carry the
price. And a Nissan message carries no photograph: that capture has a 300 pixel
side shot per model and wide banners that cannot be attributed to one model,
and the wrong car is worse than no car.

Check the current state of both at any time by opening the function URL in a
browser:
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
| `abandoned_booking` | The booking page is left after an address was typed and before submit | **Live**, email and push |
| `quote` | The quote form is submitted | **Live**, email and push |
| `brochure` | A specification sheet is downloaded by a known visitor | **Live**, email and push |
| `newsletter` | The newsletter card is completed | **Live**, email and push |
| `survey` | The on-site survey is answered | **Live**, email and push |
| `showroom_visit` | The cockpit logs a walk in | **Live**, email and push |
| `test_drive_done` | The cockpit logs a completed drive | **Live**, email and push |
| `no_show` | The cockpit logs a no-show | **Live**, email and push |
| `inbox_message` | Asked for on demand. It sends a notification and writes the drawer's own message, see below | **Live**, push |

**To replace one**, author the new content and set the variable for that
channel; the message function carries the current ids as its defaults, so a
variable is only needed when one changes. Nissan's own email ids read from the
same names with `NI_` after `EMAIL_`, listed in [`nissan/README.md`](nissan/README.md).
The Lincoln names are:
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
visitor or taken from the source site. This demo's source site publishes a
starting price for every model but the Tekton, so `model_price` is offered and
carries the figure that site published; the Tekton has none and sends none.

`first_name`, `full_name`, `name`, `surname`, `email`, `gsm`, `city`,
`branch`, `purchase_horizon`, `booking_ref`, `note`, `model`, `model_id`,
`model_seats`, `model_price`, `model_category`, `model_url`, `model_image`,
`booking_url`, `contact_url`.

**Five of them are sent every time**, whatever the moment and whatever the
visitor has told us: `model`, `model_url`, `model_image`, `booking_url` and
`contact_url`. The last of those is the reason a shared content can send
someone to a contact page at all: the two demos share every push, so an address
typed into one of them belongs to whichever demo was written first, and until
2 September the completed drive notification sent Nissan visitors to Lincoln.
An address in a shared content is the bug; a tag is the fix.
With no car in play the brand name stands in for the model and the links point
at the range, so a push title, a target URL and the media field can each use
the bare tag. Those fields carry no condition, and an empty value there
leaves a hole a visitor sees before anything else. Everything else is optional
and is printed only inside `{% if (...) { %} ... {% } %}`, because a city or a
showroom has no honest stand in.

So the same booking content says Navigator, seats up to 8 and shows the
Navigator photograph to one visitor, and Corsair, seats up to 5 to the next.
Verified live on 31 August: an Aviator booking sent both channels with the
Aviator values.

### The bell drawer is one list from two sources

**Dengage's App Inbox cannot answer at the second a visitor acts, so the demo
carries its own message centre and the drawer shows both.** There is nothing
to click in the panel for the second source: it is already running.

Why it exists, measured on 1 September 2026 after an earlier note here said
otherwise. Every transactional push carries the inbox parameters the API
documents, and in this account they put nothing in the drawer: two pushes
fired at a contact holding twenty inbox messages left the count at twenty,
read straight from `/api/inbox/getMessages`. There is no endpoint that writes
to that inbox, transactional sends are documented as unavailable for the
channel, and a campaign is evaluated on a schedule. So the one channel a
visitor can see inside the page was the only one that could not answer them.

**What the message centre is.** Two tables in the demo's own database, and
about forty lines in `supabase/functions/nissan-booking-confirm`. Every moment
the demo raises writes a row the instant it is raised, the same way the email
and the notification go out. The drawer reads it, merges it with whatever
Dengage's own inbox holds, sorts by time and draws one list. Nothing in it is
staged: a row exists because a moment genuinely happened, its copy is filled
with the same values the email and the push were personalized with, and it
records which Dengage channels carried that same moment, saying `inbox only`
when neither did.

**What this changes on a call.** Book a test drive and the bell moves while
the confirmation is still arriving. Log a walk in on the cockpit, on a
different machine, and the visitor's own drawer lights up about fifteen
seconds later with nobody touching their screen. Both are the real behaviour
of a production build with a real time inbox behind it.

**Editing the copy takes one statement and no deploy.** Ten moments per brand
live in `ni_inbox_template`, keyed by brand and moment, with `{model}` and the
other send parameters as placeholders:

```sql
update ni_inbox_template
   set title = 'Your {model} drive is booked',
       body  = 'We have your request. The showroom will call you to agree a time.'
 where brand = 'nissan' and moment = 'booking';
```

**Dengage's own inbox still works and is still worth showing.** Send from a
campaign or a journey and press Refresh, the path row 314 above describes.
Those messages sit in the same list beside the instant ones, and only they are
reported back to Dengage: an impression, an open or a delete is never sent
against a message Dengage did not issue.

### What decides whether a push lands, and how to check

The push carries no inline text: every word comes from the saved content, so
personalization is only ever through the parameters above. And Dengage holds
the device token against whichever contact key claimed it last, so a push
addressed to an older key answers `no device subscribed for this contact`.
The live flow always addresses the key that just acted, which is why it lands.

**HTTP 200 is not a success, and reading it as one hid a real failure.**
Recorded from live sends on 1 September 2026: every transactional endpoint
answers 200 for a refusal as well as for a send, and puts the outcome in the
body, `{transactionId, code, message, data}`, where `code` 0 is Successful.
Code 11 is `Token not found with given ContactKey`, the normal state for a
device that has not claimed this contact yet, and the one refusal with a second
path worth trying: the demo then addresses the token the page is holding. The
send function now reads that code rather than the status, so a refusal is never
reported as a send.

**A token send is accepted blind.** Dengage answers code 0 for a device token
it has never seen, so `sent to this device` means Dengage took the request, not
that a browser drew a notification. The storefront therefore refreshes the
token it holds every thirty seconds rather than caching the first one it saw
and never asking again: a token that has since been replaced would otherwise
produce a message reported as sent that reached nobody.

**Where to look when a notification does not appear.** Every moment now records
what Dengage answered, per channel, in `ni_inbox.detail`. One statement gives
the whole run:

```sql
select sent_at, moment, channels, detail
  from ni_inbox
 where sent_at > now() - interval '1 hour'
 order by sent_at desc;
```

`channels` says which channels carried the moment. `detail` carries Dengage's
own reply, so a push that was refused, a push that went to the contact and a
push that went to the token are told apart at a glance. Until now only a
booking kept this, on `ni_web_lead`, which is why a rescue push that did not
arrive left nothing to read. The `?debug=1` readout shows the same outcome on
the page as it happens.

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
