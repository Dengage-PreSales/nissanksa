# Brief for the next session: a Bakcell branded telecom marketplace on Dengage

Written 3 September 2026. This is the one document to load into the new session. It has two
parts:

- **Part A** is the brief for the new build: the decisions already taken, the rules, the source
  site inventories, the proposed page map, moments, data model, personas, setup order, and the
  open questions that still need a yes or a no.
- **Part B** is the complete Dengage capability handoff distilled from the Nissan and Lincoln
  demos: every SDK call, REST body, panel contract, account fact and gotcha, industry neutral.
  Nothing in Part B depends on the old repository being available.

Everything in Part A marked **PROPOSAL** is a starting point to confirm or change, not a decision.
Everything marked **CONFIRM** is a question the demo owner has to answer before that item is built.

---

# Part A. The build

## A1. Decisions taken on 3 September 2026

Recorded verbatim in substance from the demo owner's answers.

| # | Topic | Decision |
|---|---|---|
| 1 | Dengage application | A **different Dengage application** from the Nissan one. Data layer events carry the prefix **`es_`** |
| 2 | Supabase | **Same Supabase project** (`raextqlludkagdntyzwn`), **new table names with no overlap** on existing ones. **New Dengage API user.** **Same VPS egress proxy.** **Same read-only database role** (`dengage_reader`) |
| 3 | Hosting | **GitHub Pages under a new origin**, with a **new service worker file**. The demo owner will place the service worker (answer 17) |
| 4 | Repository | A **new GitHub account** and a **new repository** |
| 5 | Language and currency | **Standard English.** Currency written as "ANZ"; Bakcell prices are in Azerbaijani manat, so this is read as **AZN (₼)**. **CONFIRM** that AZN is meant |
| 6 | Scope of sections | **All** of the du.ae personal structure |
| 7 | Brand | **Bakcell** |
| 8 | Page authoring | **Author the pages fresh** in Bakcell's style. No capture of either site |
| 9 | Magento | **Look and feel target only.** No integration story |
| 10 | Marketplace mechanics | The ones **worth showcasing the power of Dengage**, not repetitive ones |
| 11 | Product feed and recommendations | **In scope.** The **product feed is created in Supabase**; the demo owner will **sync or upload it into the new Dengage application**. Very important given categories, items, bundles |
| 12 | Channels | **Everything live.** A **mobile app** for the same demo will also be created |
| 13 | Telecom dataset as remote source | **Yes.** This is the essence of the story: everything to do with telecom and its possibilities |
| 14 | Standing decisions from Nissan (no custom contact columns, inbox delete not reported, canvas-only journeys) | **Do not carry over.** Show and leverage everything possible. **Show nothing impractical or impossible for Dengage.** Ask yes or no questions when unsure |
| 15 | Personas | **Fresh set**, still in the **DPS** namespace |
| 16 | Demo factory and CLAUDE.md | **Yes**: the factory exists in another repository, and the new repository should carry a CLAUDE.md derived from it |
| 17 | Service worker | The demo owner will handle it |
| 18 | Where things run | **Everything realtime is done by the site itself** (do not load Dengage unnecessarily for demos). **Dengage is used wherever it is needed.** **Nothing on the website that is not possible for Dengage.** Ask when in doubt |

## A2. Rules for this build

Carried from the Nissan work and still binding:

1. Nothing ever deletes, truncates or edits what already exists in Dengage or in the shared
   Supabase project. Every step creates something new. New tables only, no overlap on `ni_`,
   `dps_`, `rh_`, `hy_` objects.
2. Contact keys stay in the `DPS-` namespace and every server endpoint validates the shape.
3. Every browser storage key is namespaced by the demo slug.
4. Every page fires `pageView` first, so its rows are findable by `page_url`.
5. Omit unknown numbers; never send a zero or an invented figure. A price the source does not
   publish is not shown.
6. One module talks to the SDK. Everything else goes through it.
7. An HTTP 200 means accepted. Storage lags about two minutes. Read outcome codes in bodies.
8. Journeys unverified by rehearsal are shown as their canvas and said so plainly.

New for this build, from the demo owner:

9. **The possibility rule.** Nothing appears on the website that Dengage cannot do. Every
   experience, message and segment on the site maps to a real Dengage mechanism named in Part B
   or confirmed by the demo owner. When a telecom idea needs a capability Part B does not prove,
   it goes to section A11 as a yes or no question first.
10. **Realtime by the site, Dengage where needed.** Instant reactions to a click (a confirmation
    card, a drawer message, an on-site experience appearing) are drawn by the site itself, as the
    Nissan build did with its own creatives engine and its own message centre. Dengage carries
    what only Dengage can: the profile, the events, the segments, the journeys, the push, the
    inbox, the email, the SMS, the on-site campaigns when the engine is meant to be shown, and the
    recommendations. Do not fire Dengage calls for decoration.
11. **Everything is shown.** No capability is parked by default. Custom contact columns are
    allowed if useful. Inbox delete is reported to Dengage. Journeys are built in the panel and
    rehearsed, not only drawn.

## A3. Names and identifiers

| Thing | Value | Status |
|---|---|---|
| Brand | Bakcell | decided |
| Data layer event prefix for brand campaigns | `es_` (for example `es_plan-finder-nudge`) | decided |
| Demo slug on `<html data-demo-slug>` and in storage keys | `bakcell` (storage `dps:bakcell:*`, events `dps:bakcell:event`) | PROPOSAL |
| Supabase table prefix | `es_` (matches the event prefix; `ni_` was Nissan's) | PROPOSAL, CONFIRM |
| Edge function names | `es-lead-relay`, `es-message`, `es-dengage-tables`, `es-persona-seed`, `es-contact-peek`, `es-product-feed` | PROPOSAL |
| Custom Data Space event table | `es_events` | PROPOSAL |
| Persona keys | `DPS-ES-1` to `DPS-ES-8`. If the new application shares the Nissan account, `DPS-1` to `DPS-8` already exist there | PROPOSAL, CONFIRM (see A11 question 1) |
| Order id convention | `DPS-bakcell-<kind>-<timestamp>` with kinds `order`, `topup`, `esim`, `roam`, `addon`, `panel`, `sim` (simulator) | PROPOSAL |
| Dengage account id and appGuid | to be created; the head snippet takes both | pending from the demo owner |
| Published origin | `https://<new-account>.github.io/<repo>/` | pending |
| Service worker | at the new origin root, placed by the demo owner | pending |
| API user | new; needs the transactional API permission; the existing VPS egress IP allowlisted on the new application's account | pending |

## A4. Source site inventories

### A4.1 du.ae personal, the structure to follow

Read from `https://www.du.ae/sitemap.xml` on 3 September 2026. The pages themselves are
client-rendered and were not readable; the URL set is complete.

**Top level**: `/personal`, `/personal/whydu`, `/personal/our-network`, `/personal/changetodu`,
`/personal/shop` (`/prepaid`, `/postpaid`).

**Mobile** (`/personal/mobile`):
- Plans: `prepaid-plans` (`voice-plans`, `tourist-sim`, `plans`, `prepaidfromdu`,
  `how-to-recharge`, `pay-as-you-go/quick-recharge`, `pay-as-you-go/recharge-cards`,
  `pay-as-you-go/mobilecredittransfer`, `pay-as-you-go/more-data-WoW`), `postpaid-plans`
  (`new-emirati-plan`, `plan-details/...`), `control-plans`, `prepaid`, `change-to-du-mobile`
- Data: `data` (`databundles`, `internetkey`, `more-time-bundle-offer`), `data-sim`
- Add-ons: `add-ons` (`multi-sim`, `datapacks`, `premium-bundles`, `national-minutes-pack`,
  `daily-saver-bundle`, `more-time-bundle-offer`)
- Roaming: `visiting-roaming` (`roaming-rates`, `roaming-voice-rates`, `roaming-data-bundles`,
  `roaming-preferred-partners`, `4g-lte`)
- Devices: `phones-and-tablets` (`apple-ipad`, `alcatel1`)
- Payments: `pay-with-du` (`what-is-pay-with-du`, `google-play-store`, `itunes-app-store`,
  `samsung-apps`, `shahid-plus`)
- Value added: `value-added-services` (`international-top-up`), `valueaddedservices/call-me-sms`
- Entertainment: `entertainment` (`voice-mail`, `caller-tunes`, `callertunes/shuffle`,
  `missed-call-alert`, `musicstore`, `videostore`, `content-services` by category: Sports,
  Downloads, Miscellaneous, Islamic, News, Women, Music, Business)
- Special offers: `specialoffers` (about twenty: `data-sim-offer`, `international-booster-pack`,
  `smartphone_value_back`, `anghami`, `du-tuesday`, `out-of-credit`, `du-the-entertainer-app`,
  `etihad-millionaire`, `internet-calling-app`, `du-Concierge`, `play-on-demand`,
  `non-stop-data-bundle`, `fly-with-myaccount`, `iphone-every-year`, `call-home-for-less`,
  `kabayan-offer`, `international-savings-offer`, and country calling offers)
- App: `mobileapps/du-app`

**At home** (`/personal/at-home`): `broadband`, `homephone`, `packages` (by zone), `TV/du-tv`,
`TV/movies-on-demand`, `TV/view-anywhere`, `offers` (`gaming-console-bundles`, `stingray-music`,
`world-calling-pack`), `specialoffers/internet-calling-app/home`, `moving-to-a-new-home`,
`change-to-du-home`, `shop-for-devices`.

**Support** (`/personal/support`, `/personal/helpandsupport`): support categories and articles;
`mobile/faqs` (MNP, internet key, recharge cards, general), `mobile/data-guide`,
`mobile/data-calculator`, `mobile/roaming`, `mobile/id-registration`, `mobile/Spam-SMSes`,
`mobile/Getting-started`, `billing-and-payment` (`payment-and-recharge`, `read-your-bill`,
`ebill`, `quick-pay`, `billing-faqs`, `payment-and-recharge-options`), `no-objection-certificate`
(six pages), `ourshops`, `at-home-support` (tariff guide, forms, FAQs, troubleshooting, speed test,
McAfee), `contact-us`, `my-account-support`, `support/valueaddedtax`.

Shape of the du.ae personal home page, as known from the site rather than the fetch: hero
carousel of offers, plan cards with price, data, minutes, validity and contract length, a device
carousel, an app promotion, and a footer. Card fields to mirror: name, price per month or per
period, data allowance, national minutes, international minutes where relevant, validity or
contract term, and a primary Buy or Join button plus a secondary Details link.

### A4.2 Bakcell, the products and the look

Read from `https://www.bakcell.com/sitemap.xml`, `/en`, `/en/go-11-99`, `/en/services`,
`/en/esim`, `/en/top-up`, `/en/iphone-devices` on 3 September 2026, plus the screenshot of the
home page supplied by the demo owner. Tariff listing pages load their cards dynamically and were
not readable; the individual tariff pages render fully.

**Navigation**: black utility bar with Individual, Business, About us, then Balance, Support,
language (AZ, EN, RU) and a light or dark mode toggle. White main bar: red Bakcell logo, Tariffs
(GO, GO Pro), Internet, Roaming (Internet packages, All-in-One bundles, Call packages, SMS
packages), Services, a red **Bakcell Shop** button, search, an app grid icon, **Join Bakcell**
(outlined) and **Log in**. Footer: About Us, Services, Support, Contact; phone `555` and
`+994124988989`; social links; © Bakcell LLC.

**Home page sections** (screenshot and fetch): app install prompt, hero carousel (red gradient,
"Süni intellekt üçün internet Bakcelldən!" meaning free internet for AI apps, with ChatGPT,
Claude, Perplexity, DeepSeek icons), promotional banners (Game Center, Free AI), the **GO** tariff
carousel with an **Archive** link, "Subscribe to our news", footer.

**Tariff families and pages** (all under `/en/`): GO (`go-099`, `go-3-99`, `go-7-99`, `go-11-99`,
`go-17-99`, `go-29-99`, `go-59-99`, `go-89-99`), GO Pro (`go-pro-tarifleri`), Star (`star`,
`star3gb`, `star5gb`, `star7gb`, `star9gb`), Star Pro (`starpro-17gb`, `-27gb`, `-40gb`, `-60gb`,
`-80gb`), Klass prepaid and postpaid (`klass8`, `klass13`, `klass19`, `klass31`, `klass55`, and
`-postpaid` variants incl. `klass50-postpaid`), legacy (`sade`, `ilk`, `birinci-tariff`,
`daimonline*`, `tariffs-archive`).

**GO 11.99, fully read** (the template for a plan product):

| Field | Value |
|---|---|
| Name | GO 11.99 |
| Price and period | 11.99 ₼ per 28 days; minimum balance to activate 11.99 ₼ |
| Internet | 5 GB (social media allowance per the card); an internet package is mandatory on this plan; 5 MB billing interval |
| Free AI | Free, 1 GB fair use, text image and video generation on ChatGPT, Claude, Perplexity, DeepSeek |
| Free messaging | WhatsApp text, 1 GB |
| Minutes | 300 min countrywide; without package 0.30 ₼/min; to 555 0.08 ₼/min; 60 second billing |
| SMS | 150 SMS; domestic 0.19 ₼, international 0.32 ₼ |
| Activation | USSD `*905#` on the card, `*905*2#` renewal; app activation with QR; buttons **More** and **Join now** |
| Rules | emergency numbers free; one-way blocking on expiry without payment; unused balances expire on migration |

From the screenshot, the other two cards: **GO 17.99** (10 GB internet, 1 GB social media for
Facebook and Instagram, free WhatsApp, 600 min, 300 SMS, `*910#`) and **GO 29.99** (25 GB, 3 GB
social media for Facebook, Instagram, YouTube, TikTok, free WhatsApp, 1500 min, 500 SMS, `*925#`).
All three carry "Free Artificial intelligence" as the first feature line.

**Internet products**: `internet` ("Unlimited internet packages!", "High-volume packages"),
`5-gb`, `500mb`, `internet-daily-packages`, `weekly-packages`, `archive-internet-packages`,
`social-media-packages`, `unlimited`; Wi-Fi (`bakcell-wi-fi`, `wi-fi-packages`, `bakcell-wi-fi-5`
to `-175`); `fiber`, `fiber-check`; `5g`, `volte`, `vowifi`.

**Roaming**: `roaming`, `internet-roaming`, `roaming-internet-packages`, `roaming-call-packages`,
`roaming-sms-packages`, `sms-roaming`, `all-in-one-in-roaming`, `prices-and-countries`,
`before-trip`, `for-foreign-guests`, `travelsim`, `azal` (airline partnership).

**Services** (from `/en/services`): Popular: VoLTE, eSIM, Bakcell app. Balance: Balance top-up
(1 to 250 ₼), Balance notification, CINKredit, KlassKredit (up to 20 ₼), Money transfer.
Messaging: SMS bundles (50, 150, 250, 500, 1000), SMS Radar, Bulk SMS, AI Talk, Goal+, two
donation services. Call management: Owner of my number, The dialing rule, Conference call, Lovely
numbers, Be My Guest, I Am Back, I Called You, Call Divert, Hidden Number, Call Waiting, Voice
Mail, Call and SMS barring. Additional: Internet activation, Security of your number, Asan İmza,
MNP, Zəngim+, Call signature, NaviMax, AzParking, Security+, Bakcell Fiber, Singit.

**eSIM**: two flows, "Get a new eSIM" (Buy now, `/en/number-sale?tab=esim`) and "Switch your
number to eSIM" (Get started, `/en/esim-checkout?tab=swap`); `esim-addresses`, `esim-result`.
**Numbers**: `number-sale`, `lovely-numbers`, `offers-for-mobile-numbers`, `099_prefix`.

**Top-up**: `/en/top-up` form with phone number, amount 1 to 250 ₼ with 1, 5, 10 ₼ quick picks,
Continue; USSD `*101*<card>#`; balance check `*100#` (0.09 ₼); `automatic-top-up`,
`online-payment`, `bakcell-card`, Birbank partnership (`birbank-app`).

**Devices**: `bakcell-shop` redirects (301) to `https://shop.bakcell.com/az`, which answered 403
to a plain fetch; `iphone-devices` ("iPhone with Bakcell speed!", 10 GB free data for 18 months,
12 months warranty, one-time payment or instalments up to 18 months with Birbank Card),
`xiaomi-devices`, `honor-redmi-tablets`, `yeni-4g-sim`, `4g-sim-kart-5-gb`.

**Campaigns and partnerships**: `campaigns`, seasonal (`novruz-campaign`, `8-march-campaign`),
`f1heyecani`, `be-my-guest`, `i-am-back`, `super-cume`, `metroplus`, `elagun`, `elasaat`,
`elaay`, `uber`, `yango`, `air-arabia`, `azparking`, `navimax`, `galaxyz`.

**Brand cues from the screenshot** (to be refined against the live site in the new session):
black `#000`-ish utility bar; white nav; brand red close to `#E4002B` for the logo, the Shop
button and the card headers; tariff cards with a red gradient header, a black price tag pill
("GO 11 99"), USSD digits as small white tiles, a pale pink body (`#FFF0F3`-ish) with icon rows,
and two buttons, outlined **More** and solid red **Join now**; rounded corners around 12 px; a
geometric sans headline face; light and dark modes.

### A4.3 The proposed page map for the marketplace

**PROPOSAL.** du.ae's structure with Bakcell's products in it, Bakcell's look, English, AZN.

| Section | Pages | Product types on them |
|---|---|---|
| Home | hero offers, plan carousel (GO, GO Pro, Star, Klass), device carousel, internet packs, app promo | plans, devices, packs |
| Mobile > Plans | prepaid plans (GO, Star), postpaid plans (Klass postpaid), plan detail pages, plan compare, plan finder (a usage quiz) | plans |
| Mobile > Internet and add-ons | internet packages (daily, weekly, monthly, unlimited, social media, 5 GB, 500 MB), SMS bundles, minute packs, Free AI, VoLTE, VoWiFi, 5G | add-ons |
| Mobile > Roaming | roaming internet, all-in-one, call and SMS packs, prices and countries selector, before-trip checklist, TravelSIM | roaming packs |
| Mobile > Numbers and SIM | new number with eSIM or physical SIM, lovely numbers, switch to eSIM, MNP (change to Bakcell), 4G SIM | SIM and eSIM products |
| Shop | phones (iPhone, Xiaomi, Honor, Redmi), tablets, accessories, routers, with instalments up to 18 months, brand and price filters, stock, colour variants, device plus plan bundles | devices, bundles |
| At home | Bakcell Fiber, Wi-Fi packages, fiber availability check, home devices | fixed products |
| Services | the services catalogue from A4.2 grouped as Bakcell groups them | services |
| Top-up and pay | top-up form, auto top-up, pay a bill, money transfer | payments |
| Offers | campaigns, seasonal, partner offers, archive | promotions |
| Account | sign in, my numbers, my plan and usage, my orders, my inbox, my saved items | profile surfaces |
| Support | help topics, FAQs, data calculator, stores and addresses, contact, chat | support |
| Presenter only | operations simulator (the BSS, care desk and store stand-in), verification console | demo tooling |

## A5. The moments worth showing, mapped to what Dengage does

**PROPOSAL.** Chosen for range, not repetition: each row exercises a different Dengage
mechanism or a different table, column or channel. The right column says whether Part B proves
the mechanism or whether it needs the demo owner's confirmation first.

### A5.1 Realtime on the site (drawn by the site, recorded in Dengage)

| Moment | Dengage mechanism | Status |
|---|---|---|
| Browse a plan, a device, a pack | `pageView` type `product` with product id, price, category path; `category` and `promotion` types on listings and offers | proven |
| Search the catalogue | `ec:search` once per settled query, with `result_count` and `filters` | proven |
| Compare plans, run the plan finder | custom table rows (`compare`, `plan_finder` carrying the answers: current spend, data need, switching horizon) | proven pattern |
| Add a device, a plan, a pack and an accessory to **one cart** | `ec:addToCart` with a multi-line `cartItems`, remove before add on a swap, `ec:deleteCart` on emptying. This is the first demo where the cart genuinely holds several lines | proven |
| Start checkout: choose a number or eSIM, port in a number | `ec:beginCheckout` once the cart names an item; custom rows `number_selected`, `esim_selected`, `mnp_requested` | proven pattern |
| Place the order with a promo code | `ec:order` with `coupon_code`, `payment_method` from the documented vocabulary (`online_payment`, `mobile_payment`, `bank_transfer`, `prepaid_card`); `order_events_detail` carries the lines | proven |
| Cancel an order | `ec:cancelOrder` naming the order | proven |
| Save a device, wait for stock, watch a price | `wishlist_events` with all four list names: `favorites`, `shopping_list`, `back_in_stock_alert` (device out of stock), `price_drop_alert` | proven (two of four lists were used before) |
| Top up a balance | `ec:order` (a real purchase) plus a custom row `topup` with amount and method | proven pattern |
| Buy a roaming pack with a travel date | `ec:order` plus a custom row `roaming_pack` carrying destination and dates | proven pattern |
| Activate an add-on or a service | `ec:order` for paid ones, custom row `service_activated` for free ones | proven pattern |
| Sign in to the account | `setContactKey` with the customer's key (`DPS-ES-n` in the demo, the operator's customer id in production), `pageView('login')` | proven |
| Newsletter, stock alert, price alert capture | the engine's subscription form contract, or the site's own card posting to the relay | proven |
| A one-question survey or NPS after support | the engine's question form contract writing a contact tag | proven |
| Confirmations on the spot | site-drawn confirmation card repeating what was typed, own inbox row, transactional email and push through the message sender | proven |
| Abandoned cart and abandoned checkout | the ecommerce abandonment mechanic on `shopping_cart_events`, site-drawn rescue on exit intent, `abandoned_checkout` message, and a real panel journey | proven for the message; journey to be built and rehearsed |

### A5.2 Operator-side events (simulated source, real Dengage)

A presenter page standing in for the BSS, the care desk, the store and the chatbot. Each button
writes a real custom row, some also write an order, and the ones the customer should hear about
call the message sender.

| Signal | What it demonstrates | Status |
|---|---|---|
| Data usage crossed 80 percent, then 100 percent | usage-triggered upsell: push and SMS offering a pack, on-site bar next visit | proven mechanism (custom row plus transactional); the *segment* version needs the remote usage table |
| Balance low, plan expiry approaching | top-up reminder journey | proven mechanism |
| Renewal succeeded, renewal failed | payment recovery | proven mechanism |
| Postpaid bill issued, due, paid | billing communications with the amount as `$Current` | proven mechanism |
| Number activated, eSIM installed | onboarding welcome series | proven mechanism |
| Port-in completed, port-out requested | win and save moments, churn signal | proven mechanism |
| Roaming detected abroad | arrival push with the pack that fits | proven mechanism |
| Store visit, care call outcome, chatbot intent | offline signals on the same profile as web behaviour | proven |
| Device contract ending, upgrade eligible | upgrade audience | proven via remote view |
| Complaint opened and resolved | care follow-up and NPS | proven mechanism |

### A5.3 Dengage-side (the panel, shown live)

| Capability | Where it comes from | Status |
|---|---|---|
| Contact 360 with web, app, order, wishlist and operator history on one card | the standard tables, the custom table, the contact | proven |
| Segments over remote Postgres views (heavy users on small plans, low balance and high usage, roamers, dormant, upgrade eligible, family bundle candidates, churn risk, switching within a month) | Remote Data Source, one flat view per segment, every row contact-keyed | proven pattern |
| Segments over standard tables (device wishers, stock waiters, price watchers, cart abandoners) | `wishlist_events.list_name`, `shopping_cart_events` | proven |
| Journeys: welcome, abandoned checkout, usage upsell, renewal recovery, roaming arrival, win-back | Marketing tab; triggers on `order_events`, `beginCheckout`, segment entry, custom events | to build and rehearse |
| On-site campaigns fired by `es_` events, plus native exit intent and scroll depth | Custom HTML campaigns with display rules on the new path | proven contract; the shared library does not exist on a new application, see A11 |
| Web push with rich image, app inbox, transactional email | proven | proven |
| SMS live | Content > SMS with a sender id | CONFIRM sender id on the new application |
| WhatsApp live | depends on the channel setup of the new account | CONFIRM |
| Product recommendations | product feed from Supabase synced by the demo owner; recommendation widget in the inline slot | CONFIRM format and widget |
| Dynamic content creatives reading a product table per contact | template tag creatives | CONFIRM |
| A/B test, gamification, story | shared library patterns | to recreate on the new application |
| Mobile app: push, in-app, inbox, events | Dengage mobile SDK | not covered by Part B, CONFIRM stack |

## A6. Data model in Supabase

**PROPOSAL.** All names `es_`. Every table Dengage will read as a remote source carries
`contact_key`. Reference tables without a contact key (products, stores) are read by the site
and by views, never connected directly.

### A6.1 The product feed

`es_product`: `product_id` (text, primary), `sku`, `name`, `type` (`plan`, `internet`, `addon`,
`roaming`, `device`, `accessory`, `sim`, `esim`, `number`, `fixed`, `service`, `bundle`),
`family` (GO, GO Pro, Star, Klass, iPhone, Xiaomi...), `category_path` (for example
`Mobile>Plans>Prepaid`), `price` (numeric, AZN), `discounted_price`, `period_days`, `data_gb`,
`social_gb`, `minutes`, `sms`, `free_apps` (text[]), `ai_free` (bool), `ussd_code`,
`brand`, `model`, `storage`, `colour`, `instalment_months`, `instalment_monthly`, `in_stock` (int),
`image_url`, `page_url`, `tags` (text[]), `active` (bool), `updated_at`.
`es_bundle_item`: `bundle_id`, `product_id`, `quantity`, `bundle_price`.
`v_es_product_feed`: the flat view shaped for Dengage's product import, one row per sellable
item, with the column names the import expects. **CONFIRM the import format** (A11 question 8).
`es-product-feed` function: serves the same view as JSON and as XML at a public URL for a feed
based import, if that is the format.

### A6.2 The subscriber dataset (the essence of the story)

`es_subscriber`: `contact_key`, `msisdn` (555-block invented), `full_name`, `city`, `plan_id`
(product id), `plan_type` (`prepaid`, `postpaid`), `activation_date`, `contract_end`,
`device_model`, `device_age_months`, `arpu`, `lifecycle` (`new`, `active`, `dormant`,
`at_risk`, `churned`), `esim` (bool), `family_lines` (int).
`es_usage`: `contact_key`, `period_start`, `data_cap_gb`, `data_used_gb`, `minutes_used`,
`sms_used`, `roaming_days`, `balance`, `last_topup_at`, `last_topup_amount`.
`es_billing`: `contact_key`, `invoice_id`, `issued_at`, `due_at`, `amount`, `status`.
`es_ticket`: `contact_key`, `opened_at`, `channel`, `topic`, `status`, `nps`.
`es_offline_event`: `contact_key`, `event_type`, `product_id`, `store_id`, `source`, `note`,
`event_date` (store visits, care calls, chatbot intents, port requests, roaming detections).
`es_store`: `store_id`, `name`, `city`, `lat`, `lng` (reference, not connectable).
`es_web_lead`: every typed lead with UTM, consent, Dengage status and detail (the relay's table).
`es_inbox_template`, `es_inbox`: the own message centre.

Views, one per segment, all `security_invoker = true`, all granted to `dengage_reader`:
`v_es_contact_360`, `v_es_heavy_on_small_plan` (used over 90 percent of cap two periods running),
`v_es_low_balance_high_usage`, `v_es_plan_expiring_7d`, `v_es_renewal_failed`,
`v_es_roamers_now`, `v_es_frequent_travellers`, `v_es_dormant_30d`, `v_es_churn_risk`
(port-out request or two failed renewals or a complaint plus low usage), `v_es_upgrade_eligible`
(contract ending within 60 days or device older than 24 months), `v_es_family_candidates` (two or
more lines at one address), `v_es_switchers_1m` (plan finder answered "within a month"),
`v_es_stock_waiters_with_stock` (wanted device now in stock at their store).

Seeding: deterministic (`setseed`), invented values that announce themselves, eight engineered
persona rows matching the simulator line for line, and counts recorded in the runbook so quoted
segment sizes are exact.

### A6.3 The custom Data Space event table

`es_events` created in the new application's Data Space: `event_id` (text), `event_type` (text),
`product_id`, `product_type`, `plan_id`, `amount` (text), `destination`, `travel_from`,
`travel_to`, `store`, `source`, `note`, `horizon`, `is_used` (bool).

`event_type` list (fixed, validated in the events module): `compare`, `plan_finder`,
`number_selected`, `esim_selected`, `mnp_requested`, `topup`, `roaming_pack`,
`service_activated`, `usage_80`, `usage_100`, `balance_low`, `plan_expiring`,
`renewal_ok`, `renewal_failed`, `bill_issued`, `bill_paid`, `number_activated`,
`esim_installed`, `port_in_done`, `port_out_requested`, `roaming_detected`, `store_visit`,
`care_call`, `chatbot_intent`, `complaint_opened`, `complaint_resolved`, `upgrade_eligible`,
`survey_response`, `register_interest`, `creative_shown`, `creative_action`.

## A7. Personas

**PROPOSAL**, eight fresh telecom stories in the DPS namespace (`DPS-ES-1` to `DPS-ES-8`),
each seeded in `es_subscriber`, `es_usage`, `es_offline_event` and the simulator alike:

| Key | Story |
|---|---|
| DPS-ES-1 | Prepaid GO 11.99, hits 80 percent of data every period, browsed GO 29.99 twice. The upsell character |
| DPS-ES-2 | Postpaid Klass, iPhone contract ending in 45 days, saved a new iPhone, waiting on stock |
| DPS-ES-3 | Frequent traveller, roaming detected in Türkiye three times this year, never bought a pack |
| DPS-ES-4 | Balance below 1 ₼ twice this month, plan expired once, top-up by card each time |
| DPS-ES-5 | Requested port-out yesterday after a complaint about coverage. The save character |
| DPS-ES-6 | New number activated this week, eSIM, no add-ons yet. The onboarding character |
| DPS-ES-7 | Three lines at one address on separate plans. The family bundle character |
| DPS-ES-8 | Dormant 40 days, last seen on the AI internet campaign page. The win-back character |

## A8. Setup order for the new session

1. **Repository.** Create the repo on the new account. Add the demo factory repository to the
   session and derive the new `CLAUDE.md` from it (decision 16). Clone the public Nissan repo for
   code lifting (A9) and copy the neutral kit.
2. **Dengage application.** Create the web application; take `accountId` and `appGuid` into the
   head snippet and the config. Note whether it sits in the same account as the Nissan one (A11
   question 1).
3. **Service worker** at the new origin root (demo owner). Enable GitHub Pages.
4. **API user** on the new application's account with the transactional permission; allowlist
   the existing VPS egress IP there; put the credentials in Supabase secrets under new names.
5. **Supabase.** Create the `es_` tables, views, policies and grants to `dengage_reader`; seed;
   deploy the `es-*` functions with the new secrets; check every health GET.
6. **Remote Data Source** in the new application pointing at the same Postgres, connect the
   contact-keyed views, build one segment and check its count is the seeded number.
7. **Custom event table** `es_events` in Data Space before any page sends to it.
8. **Product feed** (`v_es_product_feed` or the feed URL) handed to the demo owner to sync.
9. **Storefront** pages authored fresh, with the head order, the module set, the slots, the
   launcher, the drawer, the readout, the simulator and the console.
10. **Panel content**: `es_` on-site campaigns for the experiences the engine should be seen to
    serve, push and email contents per moment, SMS contents, inbox contents, journeys.
11. **Verification**: the SDK-refusing suite, the audits, the phone check, then the live
    rehearsal against the new account, then the walkthrough runbook.

## A9. Access to the old work

The Nissan repository is public, so the new account can read it without permissions:

```bash
git clone https://github.com/Dengage-PreSales/nissanksa.git
cd nissanksa && git checkout claude/telecom-marketplace-dengage-r1nox0   # carries handoff/
git archive --format=tar HEAD js/identity.js js/dengageEvents.js js/debug.js js/slots.js js/inbox.js \
  js/panels.js js/copy.js assets/css/demo-controls.css supabase tools verify panel/creatives \
  panel/nissan/_tag-check.html manifest.webmanifest .nojekyll | tar -x -C /path/to/new/repo
```

Part B section 15 says which of those files copy verbatim, which adapt, and which are rewritten.
The demo factory (CLAUDE.md, checks, panel scripts) is a separate repository the demo owner will
add to the session.

## A10. What the site must not pretend

Under the possibility rule, these are the lines the Nissan work found and the telecom story must
respect until the demo owner says otherwise:

- The App Inbox fills from campaigns and journeys, not from transactional sends. Instant drawer
  messages come from the site's own message centre, shown beside Dengage's.
- A transactional message sees only the values passed in the call, never the contact record.
- A page cannot write contact fields; a backend does, over REST, from an allowlisted IP.
- A push reaches a device only after the browser granted permission on the published origin; iOS
  needs the Home Screen install; macOS shows no image.
- A device token is bound to the key that subscribed; a later key needs the token fallback.
- Custom Data Space tables must exist before rows are stored; storage lags about two minutes.
- Remote tables must relate to `master_contact` or `master_device`.
- SMS needs a sender id; WhatsApp needs a channel configured on the account.
- Anything else the telecom story wants that is not in Part B is a question in A11 first.

## A11. Open questions, yes or no where possible

Account and application

1. Is the new Dengage application in the **same account** as the Nissan one (shared
   `master_contact`, shared standard tables, shared API users) or in a **different account**?
   This decides whether `DPS-1` to `DPS-8` collide, whether the six standard tables are fresh, and
   whether the API user and IP allowlist are new objects in a new account.
2. Confirm **AZN (₼)** as the currency.
3. Confirm the Supabase table prefix **`es_`** and the persona keys **`DPS-ES-1` to `DPS-ES-8`**.
4. The shared `dengage_demo_` on-site library (subscription, survey, NPS, popups, bars, slide-in,
   story, exit intent, scroll depth, A/B, three games, five inline slots) exists on the Nissan
   application only. For the new application: **recreate it in the panel**, **rely on the site's
   own creatives plus a smaller set of `es_` campaigns**, or **both**?

Channels

5. Does the new account hold an **SMS sender id** for live SMS sends?
6. Is **WhatsApp** on the new account a native Dengage channel, or via a partner as before?
7. Which **email sending domain** and from-name should Bakcell demo emails use?

Product feed and recommendations

8. In which **format** will you sync the product feed into Dengage: a feed URL (XML or JSON), a
   CSV upload, or a Data Space product table? Which column names does the import expect?
9. Is the **recommendation widget** available on the new application, and does it render into an
   inline slot the way the parked Nissan card assumed?
10. Are **dynamic content creatives** (template tags reading a product table per contact) in scope
    for the first call?

Mobile app

11. Which stack will the mobile app use (native Android and iOS, React Native, Flutter, or a PWA
    wrapper), and is it built in the same repository and session?
12. Should the web demo already declare the app (smart banner, deep links) before the app exists?

Journeys and data

13. Which journeys must be **built and live in the panel** for the first call (welcome, abandoned
    checkout, usage upsell, renewal recovery, roaming arrival, win-back), given that realtime
    reactions are drawn by the site?
14. Are **custom contact columns** now allowed (plan, plan type, lifecycle, ARPU band on
    `master_contact`), or does behaviour stay on related rows?
15. Should the operator simulator write **usage and balance changes into Postgres** as well as
    into Dengage, so remote segments move during a call?

Presentation

16. When is the call, and which of the above must be live rather than shown as a canvas?
17. Does the demo carry the **Dengage mark** in place of the Bakcell logo, as the Nissan build
    did, or Bakcell's own logo?

---

# Part B. The Dengage capability handoff from the Nissan and Lincoln demos

The full document follows, unchanged in substance. Section numbers inside it are its own.
Every reference to a file path in it points at the public Nissan repository (A9).

## Dengage capability handoff: everything the Nissan and Lincoln demos proved about the platform

Written 3 September 2026 from the `dengage-presales/nissanksa` repository at commit `2362952`.
Purpose: let a fresh session, in a different repository, for a different industry, rebuild a
Dengage demonstration storefront without rediscovering any of this. Every fact below was either
read from committed code, from the runbooks, or from commit messages that record a live
observation against the shared Dengage account. Where something was measured rather than
documented by Dengage, the date it was measured is given.

The automotive story (test drives, showrooms, grades) is deliberately stripped out. Where an
automotive mapping is the only way to explain how a capability was exercised, it is named once
and then generalized. Section 15 has the file map for porting and section 16 lists what this
repository references but does not contain.

Vocabulary used throughout:

- **Panel**: the Dengage web console (Marketing, Content, Data Space, Settings tabs).
- **Web SDK**: the browser script loaded from `pcdn.dengage.com`; called as `window.dengage(action, payload)`.
- **Engine**: the on-site messaging runtime inside the SDK that draws popups, bars and inline content
  from panel campaigns, in a cross-origin iframe.
- **REST API**: `https://api.dengage.com/rest`, server side only, bearer token from `/login`.
- **Data Space**: Dengage's event tables (six standard ecommerce tables plus custom tables) and its
  Remote Data Sources (a Postgres it reads directly for segmentation).
- **Moment**: a business event that earns the visitor a message (email, push, inbox row).

---

### 1. The shared account, and the rules of living in it

| Fact | Value |
|---|---|
| Dengage account id | `28` |
| Web application guid (appGuid) | `99d9b8fb-0c62-5a85-3e43-2402554d93a5` |
| SDK loader URL | `https://pcdn.dengage.com/p/push/28/99d9b8fb-0c62-5a85-3e43-2402554d93a5/dengage_sdk_loader.js` |
| Hosts the presenting machine must reach | `pcdn.dengage.com` (SDK and widgets), `event.dengage.com` (event storage, fails silently when blocked), `push.dengage.com` (push) |
| REST base | `https://api.dengage.com/rest` |
| Published origin for the demos | `https://dengage-presales.github.io/nissanksa/` (GitHub Pages, branch `main`, root folder, `.nojekyll` present) |
| Push service worker | Lives at the origin root `https://dengage-presales.github.io/` and is **not in this repository**. Push works for any path under that origin because of it |
| Supabase project (stand-in backend and remote Postgres) | ref `raextqlludkagdntyzwn`, region `ap-northeast-1` |

The account and application are **shared** with other presales demos (five live demo sites and two
mobile apps at the time of writing) and with other traffic. Everything below follows from that:

1. **Nothing ever deletes, truncates or edits what already exists in Dengage.** Every step creates
   something new. A deletion of a specific object needs written approval for that object. The one
   read-only diagnostic that could have been given a table name deliberately refuses to accept one.
2. **Rows in the six standard tables are permanent** and columns cannot be added to them. Anything
   written must be identifiable by what is already there, which is why every page fires `pageView`
   first (section 3.5).
3. **Contact keys are namespaced `DPS-`** so the 90 day purge can find demo contacts. A typo in a
   contact key mints a junk contact in a shared account, so every server-side endpoint validates the
   shape `^DPS-[A-Za-z0-9_-]{1,44}$` before it will act.
4. **Every browser-storage key is namespaced by demo slug**: `dps:<slug>:ck`, `dps:<slug>:cart`,
   `dps:<slug>:wishlist`, `dps:<slug>:event`, and so on. Two demos share one origin; without the
   namespace they adopt each other's contact, cart and inbox read state. The slug is written on
   `<html data-demo-slug="...">` at build time and read synchronously by the first script.
5. **On-site campaigns are scoped by a display rule** on URL path (`/nissanksa/`), which is what
   keeps one demo's popups off every other demo on the same application. A campaign whose event
   name nothing fires never errors; it simply never appears.
6. **Two trigger-name prefixes coexist**: `dengage_demo_<slug>` is the shared platform library that
   every factory demo fires (renaming a slug silently kills the widget), and `<brand>_demo_<slug>`
   is the brand's own one-off set.
7. **An HTTP 200 from any Dengage endpoint means accepted, not stored or delivered.** The event
   endpoint stores about two minutes later; the transactional endpoints put the real outcome in
   the response body (section 5.4). This one rule explains most of the false alarms in the history.

---

### 2. The architecture pattern that worked

```
 visitor's browser                                   Dengage
 ┌──────────────────────────────────────┐            ┌────────────────────────────┐
 │ static storefront (GitHub Pages)     │  Web SDK   │ event tables (Data Space)  │
 │  identity.js  -> contact key         ├───────────>│ contact + device profiles  │
 │  SDK loader   -> initialize          │            │ on-site engine campaigns   │
 │  dengageEvents.js (ONLY SDK caller)  │<───────────│ web push, app inbox        │
 │  creatives.js (own on-site rules)    │  widgets   └──────────┬─────────────────┘
 │  inbox.js, panels.js, debug.js       │                       │ REST (bearer, IP allowlist)
 └──────────────┬───────────────────────┘                       │
                │ fetch (public endpoints, validated, rate capped)
 ┌──────────────▼───────────────────────┐            ┌──────────▼─────────────────┐
 │ Supabase Edge Functions (Deno)       │───────────>│ /login, /bulk/contacts,    │
 │  lead relay      (store, then upsert)│  via fixed │ /transactional/email|push, │
 │  message sender  (email+push+inbox)  │  egress    │ /contacts/{key},           │
 │  counts, peek, seed (diagnostics)    │  proxy     │ /dataspace/tables          │
 └──────────────┬───────────────────────┘            └────────────────────────────┘
                │ service role
 ┌──────────────▼───────────────────────┐            ┌────────────────────────────┐
 │ Supabase Postgres                    │<───────────│ Dengage Remote Data Source │
 │  demo tables + views (read-only role)│  direct PG │ (segments over flat views) │
 │  own inbox tables                    │            └────────────────────────────┘
 └──────────────────────────────────────┘
```

Why each piece exists:

- **Static site**: the replica of a real site, captured and rebuilt so it depends on no third-party
  host at runtime. Everything a visitor does fires real SDK events.
- **Edge functions as the "website backend"**: the Web SDK documents only two write calls,
  `setContactKey` and `sendDeviceEvent`. A page can never write a typed name, email or phone onto
  the contact. In production the brand's backend receives the form post and calls the REST API from
  a fixed IP. The demo stands that in with public, validated, rate-capped functions.
- **Postgres as a Remote Data Source**: this is how "offline" and first-party data (a customer
  base, store visits, tickets, usage) become segmentable next to web behaviour. Dengage connects
  directly as a Postgres client.
- **The demo's own inbox tables**: Dengage's App Inbox fills only from a campaign or journey
  (measured 1 September 2026), so an instant "message centre" needed its own store, merged into the
  same drawer.

---

### 3. Web SDK integration, exactly as proven

#### 3.1 The head, in order

Order is load bearing. Identity resolves synchronously before `initialize`; both run before any
stylesheet, because a pending stylesheet blocks every later script and a blocked corporate
network must not stop the SDK from starting.

```html
<html lang="en" dir="ltr" data-demo-slug="<slug>" data-rel-root="" data-site-path="index.html">
<head>
<link rel="manifest" href="manifest.webmanifest">                <!-- iOS web push needs this -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="<Short name>">
<link rel="apple-touch-icon" href="assets/brand/icon-180.png">

<script src="js/identity.js"></script>                            <!-- sets window.__dnInit if a key is known -->
<!-- DENGAGE SDK START -->
<script>
  (function (window, document) {
    window.dengage = window.dengage || function () {
      (window.dengage.q = window.dengage.q || []).push(arguments);
    };
    var accountId = '28';
    var appGuid = '99d9b8fb-0c62-5a85-3e43-2402554d93a5';
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://pcdn.dengage.com/p/push/' + accountId + '/' + appGuid + '/dengage_sdk_loader.js';
    document.getElementsByTagName('head')[0].appendChild(script);
    window.__dnInit ? window.dengage('initialize', window.__dnInit) : window.dengage('initialize');
  })(window, document);
</script>
<!-- DENGAGE SDK END -->
<!-- stylesheets only after this point -->
```

The `manifest.webmanifest` needs `display: standalone`, an `id`/`scope`/`start_url` for the demo
path, and 192 and 512 icons (one maskable). Without it, iOS never offers the notification prompt
(section 3.6).

#### 3.2 Identity

Resolution order, first hit wins, all synchronous in the head:

1. `?ck=<key>` in the URL, then persisted to `sessionStorage` under `dps:<slug>:ck`. This is how a
   presenter browses as any contact mid call.
2. A key already stored for this demo in `sessionStorage` or `localStorage`.
3. Nothing. The visitor stays anonymous and `initialize` is called with no key. Their events still
   land: the row's key column is the device id.

Facts about `setContactKey`, confirmed by observation:

- **It is identification, not authentication, and there is no lookup.** An unknown key does not
  fail: it creates that contact. A `?ck=` parameter alone created a contact during phase 0.
- **Passing the key to `initialize` matters.** A build that initialized anonymously and set the key
  five seconds later had `pageView` land on the anonymous device profile, so the contact card showed
  nothing.
- **Anonymous visitors get a key minted at the first moment they can be addressed**: when they
  allow push, submit any form, or are about to submit an engine capture form. The mint is
  `DPS-<Date.now()>`, a timestamp rather than a counter, because low numbers (`DPS-1`) are the
  personas a presenter is already demonstrating as. The same key later gains a name and address
  if a form is filled, which keeps one profile rather than two.
- **Engine capture forms mint their own key if none exists.** Observed on a stored contact, 10
  August 2026: a subscription submitted anonymously arrived keyed `sf_<uuid>` with no `DPS-`
  marker. The engine reads the device record at submit time, so the fix is to `setContactKey`
  before firing the campaign trigger (the launcher does this for every capture card), then send a
  `pageView('login')` so the new contact owns a page view row (section 3.5).
- **Identity does not move a push subscription.** Dengage binds a push token to whichever contact
  key posted the subscription; naming the key afterwards does not rebind it. See section 3.6.
- **Claim the device on boot for the key being browsed as** (the Lincoln build calls
  `setContactKey(claimed)` on every boot when a `?ck=` persona is active), so a push addressed to
  that persona can find this device.
- **Server-side identity resolution across the anonymous-to-known moment** is Dengage's, not the
  demo's: the device keeps its id, the SDK rebinds it, event rows stay keyed by device. Whether the
  pre-identification page views appear on the contact card should be confirmed in the panel
  before it is claimed on a call.

#### 3.3 One module talks to the SDK

`js/dengageEvents.js` is the only file allowed to call `window.dengage(...)` other than
`initialize` in the head. Everything else calls it through `window.DengageEvents`. Reasons:
one rule audits every write into a shared account; the debug readout can listen for a page-level
custom event instead of wrapping the SDK; and payload hygiene lives in one place.

The three hygiene functions that prevented real data poisoning:

```js
function compact(payload)  // drops null, undefined, '' and NaN keys. Omit rather than fabricate.
function money(value)      // Number or undefined. Never 0 for "unknown". A genuine 0 passes.
function count(value)      // rounded integer or undefined.
```

`Number(null)` is `0` in JavaScript, and a `0` in `stock_count` announces every product out of
stock, poisoning every back-in-stock segment. That bug shipped twice on the reference build.

Every send is announced on `window` as `CustomEvent('dps:<slug>:event', {detail: {action,
payload, accepted, at}})`. `accepted` means only "the SDK function existed and did not throw",
which is true before any network request. It must never be widened to mean delivered.

When `window.dengage` is not a function (no application configured), sends log `[dengage dry]`
and announce `accepted: false`, so a template runs without an account.

#### 3.4 The event dictionary

| SDK call | Payload the demo sends | Table it lands in |
|---|---|---|
| `pageView` | `page_type`, `category_path`, `product_id`, `price`, `discounted_price`, `stock_count`, `promotion_id`. SDK fills `page_url` and `session_id` itself | `page_view_events` |
| `ec:addToCart` | `product_id`, `product_variant_id`, `quantity`, `unit_price`, `discounted_price`, `cartItems[]` | `shopping_cart_events` |
| `ec:removeFromCart` | same shape as add | `shopping_cart_events` |
| `ec:deleteCart` | `{}` (no payload) | `shopping_cart_events` |
| `ec:beginCheckout` | `cartItems[]` | `shopping_cart_events` |
| `ec:order` | `order_id`, `item_count`, `total_amount`, `discounted_price`, `payment_method`, `coupon_code`, `cartItems[]` | `order_events` and `order_events_detail` |
| `ec:cancelOrder` | same shape as order, naming the `order_id` it reverses | `order_events` |
| `ec:search` | `keywords`, `result_count`, `filters` | `search_events` |
| `sendDeviceEvent('wishlist_events', row)` | see wishlist row below | `wishlist_events` |
| `sendDeviceEvent('<custom_table>', row)` | any columns defined in the panel, plus `event_id`, `event_type`, `is_used` | the custom table |
| `setContactKey(key)` | bare string, not an object | contact/device binding |

Vocabularies (documented values; free text is accepted in practice but stays inside the set so
segmentation on the column stays meaningful for everyone sharing the table):

- `page_type`: `home, category, product, cart, checkout, promotion, pricing, login, logout, other`
- `payment_method`: `credit_card, debit_card, mobile_payment, bank_transfer, prepaid_card, crypto, cod, online_payment, other`
- wishlist `list_name`: `favorites, shopping_list, price_drop_alert, back_in_stock_alert`
- wishlist `event_type`: `add`, `remove`

Rules learned about the cart and order calls:

- **`cartItems` is the current cart contents, not a delta.** The SDK derives totals and abandonment
  from it; sending only the changed line makes both wrong.
- **Dengage rebuilds a cart from its event stream.** Changing a selection must send
  `removeFromCart` for the old line before `addToCart` for the new one, or the profile shows a
  visitor holding two items. This was a correctness bug, found by reading the cart in the panel.
- **`deleteCart` belongs where a visitor genuinely empties a cart**; an order closes a cart on its
  own.
- **`cancelOrder` names the order it reverses**, so the module remembers the last order this
  browser placed (`dps:<slug>:lastOrder`) and refuses to cancel when there is none.
- **`beginCheckout` must wait until the cart names an item.** Firing it on the first keystroke sent
  an empty cart, and that empty row *is* the abandoned checkout a rescue journey would personalize
  on. Fire when both conditions hold (details started and an item known), exactly once.
- **`product_variant_id` falls back to `product_id`** when a product has no variants. Leaving it
  undefined dropped the key and every wishlist row went out without it; three tables worked and one
  did not from the same module. A product that is its own only variant is a fact, not a gap.
- **Variant ids from names must keep punctuation that distinguishes variants** (`SV` versus `SV+`
  collapsed onto one id when `+` was stripped). Spell such characters out before slugging.
- **Search fires once per settled query, never per keystroke**, or the table describes typing.
- **Order id conventions**: `DPS-<slug>-<kind>-<timestamp>` so a demo's orders are recognizable
  (`-td-`, `-res-`, `-offline-`, `-panel-` were the kinds used).

The wishlist row, written with `sendDeviceEvent` so one function owns every field (this is the
same mechanism the reference build always used; the `ec:` route stores an identical row):

```js
{
  event_id: <uuid v4>,          // required for the row to be stored (confirmed 6 Aug 2026)
  event_type: 'add' | 'remove', // required
  is_used: false,               // required; describes an entry not yet consumed
  list_name: 'favorites',
  product_id: '...', product_variant_id: '...',
  price: <number>, discounted_price: <number>, stock_count: <int>   // omitted when unknown
}
```

`expire_date` makes no difference to a stored row. Prices store identically as numbers or as
two-decimal strings.

The custom Data Space event table pattern (this is the industry-neutral version of `ni_lead_events`):

- Create the event definition in the panel first: **Data Space, new table**, columns all nullable
  text unless noted, plus `event_id` (text), `event_type` (text), `is_used` (boolean).
- Write rows with `window.dengage('sendDeviceEvent', '<table_name>', row)` where `row` carries
  `event_id` (uuid), `event_type` (a value from a fixed list the module validates), `is_used: false`
  and whatever columns the table defines.
- Until the table exists, every send is accepted by the endpoint and stored nowhere, with no error.
  The `?debug=1` readout shows the send; only a row count proves storage. The counts endpoint
  reports `not found in Data Space` for that case.
- This is where every business moment goes that has no column on a standard table. In the
  automotive demo that was 20 event types across web, store, call centre and partner-webhook
  sources, plus two reporting types (`creative_shown`, `creative_action` with `source` = `rule`
  or `launcher`) so the demo's self-drawn on-site experiences had impression and action rows the
  way an engine-served campaign does.

#### 3.5 Facts about the tables

- Six standard tables: `page_view_events`, `shopping_cart_events`, `order_events`,
  `order_events_detail`, `wishlist_events`, `search_events`. Columns cannot be added; rows cannot
  be deleted by a demo.
- **`session_id` is the only join** between `page_view_events` and the other five. **`page_url` is
  the only route back to a demo's rows.** So a demo's rows are found by `page_url` containing its
  slug, which yields the session ids, which find the cart, order, wishlist and search rows. A page
  that never fires `pageView` writes rows belonging to no identifiable demo. Hence: `pageView`
  first on every page, including simulators and consoles that are part of the demo, and a
  `pageView('login')` right after minting a contact.
- **Storage lags about two minutes** (measured 1 September 2026). A reading straight after a
  click shows nothing and means nothing.
- Verification method that worked: read whole-table counts before, walk a journey, read after.
  Twenty eight rows sent across seven tables, twenty eight stored. In a shared account a count that
  moved is not proof it was your event; a count that did not move is proof it was not.
- The debug readout can only say "sent". A content blocker on one device dropped every request to
  `event.dengage.com` while allowing `push.dengage.com`; the SDK loaded, the device registered,
  nothing was stored, and the page-level readout said sent for everything. So the readout also
  watches `fetch`, `XMLHttpRequest` and `sendBeacon` for any `dengage.com` host and lists status
  per request. Status 0 on a phone is almost always a blocker or DNS filter.

#### 3.6 Web push

SDK calls (all wrapped in the single module):

```js
window.dengage('isPushNotificationsSupported');       // throws when unsupported
window.dengage('getNotificationPermission');          // returns the permission string
window.dengage('showNativePrompt');                   // raises the browser dialog; user gesture only
window.dengage('getToken', function (token) {...});   // CALLBACK style; null until permission granted
window.dengage('getDeviceId', function (id) {...});   // CALLBACK style
```

What was learned:

- **A page can subscribe a device; it cannot send a push.** Sends come from a campaign, a journey,
  or the transactional REST endpoint (section 5.4).
- **The prompt needs a real user gesture.** Chrome counts a dismissed unprompted dialog against the
  origin, which can poison push for every later call on that machine. Use the native prompt from a
  button; the custom prompt is a panel creative and would be another popup.
- **`getToken` is callback style and resolves to nothing until permission is granted**, usually
  minutes after page load. A caller that reads its variable on the next line reads `null` every
  time. The module caches the token: poll every three seconds until it appears, then every thirty
  seconds forever, because a subscription can be replaced mid-session and a stale token produces a
  send reported as successful that reaches nobody.
- **Dengage binds a token to the contact key that posted the subscription.** A visitor who allows
  notifications before any form has no key, so a later push addressed to their new key answers
  `Token not found with given ContactKey` (code 11). Two mitigations, both used: mint a `DPS-` key
  at the moment of subscription so the device is addressable, and have the message sender fall
  back to a **push by token** (the page passes the token it holds) when the contact has no device
  bound. Only pass the token when this browser *is* that contact; a simulator firing a signal for
  someone else must never push to the presenter's machine.
- **A token send is accepted blind.** Dengage answers code 0 for a token it has never seen.
  "Sent to this device" means the request was taken, not that a browser drew a notification.
- **iOS and iPadOS deliver web push only to a site added to the Home Screen and opened from that
  icon**, and Safari only offers that when the page declares a manifest with `display: standalone`
  (or the older apple meta). Without it the permission call does nothing at all, silently. Android
  Chrome works in the tab. Detect an iOS Safari tab (`navigator.standalone !== true` and not
  `display-mode: standalone`) and print the Add to Home Screen steps instead of failing silently.
- **Rich push images**: 2:1, JPEG, under about 200KB. Portrait crops fill badly and AVIF is
  decoded by no notification or mail client. macOS shows text only (Safari and Chrome alike,
  because macOS draws the banner), so prove images on Windows Chrome or Android.
- **The blocked-permission panel**: when a browser has notifications *blocked* for the origin, the
  SDK opens its own blocked-push panel over every page load ("Catch price drops and new offers",
  dismissible). Never asked or allowed does not show it. Before a call, set the site's notification
  permission to Allow or Ask.
- **Web push needs the published origin** (service worker at the origin root and a secure origin).
  It does not work from `localhost` or `file://` in this setup, and a headless browser can never
  receive one, so "no device bound" is the correct rehearsal answer.

#### 3.7 App Inbox

The inbox is headless: Dengage serves the messages and records what happened to them; the list,
the styling and the empty state are the demo's. There is no panel template that draws an inbox.

```js
var provider = window.dengage('InboxMessageProvider', 20);   // limit; returns a provider object
provider.getMessages(limit)   // Promise<Message[]>; REJECTS WITH NOTHING when no device id yet
provider.onImpression(id)     // shown in the list
provider.onOpen(id)           // opened
provider.onClick(id, button)  // a button inside it pressed
provider.onDelete(id)         // removes it from Dengage's inbox for the device (a delete against the shared account)
```

- **Resolve the provider lazily and retry.** The SDK replaces the queue stub with its dispatcher
  when it finishes loading; a call made against the stub is queued and its return value is lost.
  Validate the shape (`typeof provider.getMessages === 'function'`) rather than probing internals.
- **A device id is required and appears a moment after `initialize`.** Push permission is not
  required: the inbox works for an anonymous visitor who has never seen a prompt. The drawer must
  tell "still starting" apart from "no messages" from "no application on this page" from "Dengage
  answered with an error". Settle with widening retries (six over about thirty seconds).
- **The inbox is contact scoped.** The SDK asks with device id and contact key together; reading by
  device alone returns nothing. A contact with twenty messages returned twenty.
- **Message shape is decided by the server**: `{ smsgId, messageJson: {...push payload...} }`.
  Read title, body, media, target URL, date and buttons through a list of candidate keys at both
  levels rather than committing to one spelling; log the first raw message per refresh.
- **Read state is the demo's** (`localStorage` under the slug); the provider exposes no is-read flag.
- **Only http(s) URLs are followed** from message fields; a panel field is data.
- **Delete is local by default**; reporting `onDelete` to Dengage is opt-in via config, because it
  is a delete against a shared account.
- **Report impressions once per message per page, when the drawer is open**, never on fetch.
- **The inbox fills from a campaign or a journey and from nothing else** (measured 1 September
  2026: two transactional pushes carrying the documented `inboxParams` at a contact holding twenty
  inbox messages left the count at twenty, read from `/api/inbox/getMessages`). There is no REST
  endpoint that writes to it. So the one channel a visitor sees inside the page could not answer
  the moment they acted, while email and push did.
- **The workaround that became a feature**: the demo carries its own message centre (two Postgres
  tables, section 7.5) written by the message sender at the instant of every send, read by the
  drawer together with Dengage's list, sorted by time, drawn as one list. Own messages carry a
  `demo-` id prefix and are **never reported back to Dengage** (impression, open, delete), because
  Dengage never issued them. The drawer wakes on the reply to a send this page made and on a 15
  second poll while the tab is visible, which is what makes a signal raised on another machine
  light up the visitor's bell with nobody touching it.

#### 3.8 On-site messaging: triggers, display, slots, theming

Triggers. The SDK supports five trigger types; three are "an event with this name" and read the
same `triggerSettings.eventName`:

- `DATA_LAYER_EVENT`: the SDK wraps `window.dataLayer.push` and watches for `{ event: <name> }`.
- `CUSTOM_EVENT` and `DENGAGE_EVENT`: `window.addEventListener(<name>)`.

Some templates (Typeform among them) do not offer Data Layer Event at all, and a card that only
pushed to the data layer was dead for those in the worst way: nothing errors and the widget never
appears. So the launcher fires **both** on every press, with the same name:

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event: eventName, actionType: eventName });
window.dispatchEvent(new CustomEvent(eventName, { detail: { slug } }));
```

A campaign has exactly one trigger, so exactly one is listened for. The only way to see a widget
twice is two campaigns sharing one event name. Native triggers used instead of an event where they
tell the story better: **exit intent** (pointer leaves through the top of the window) and **scroll
depth**; the launcher card for those shows the gesture rather than firing anything.

Display rules: **Where to display** = the demo's path prefix. Also **Show every X minutes** and
**Max show count**; the launcher offers a "reset widget display state" that clears only the SDK's
own storage keys (matching `/dengage|dn_|__dn|dnpush/i`) after listing them and asking twice.

Inline personalization: inline campaigns inject into the page's own flow at a target selector, so
the targets must exist even when empty. The five ids the shared library expects:

```
dn_inline_target_below_header      immediately after </header>
dn_inline_target_below_hero        after the hero block
dn_inline_target_in_grid           inside the product grid
dn_inline_target_pdp_below_price   product page, under the price block
dn_inline_target_above_footer      immediately before <footer>
dn_inline_target_reco              above a recommendation rail (slot kept, launcher card parked)
```

Two consequences learned:

- **Inline creatives are not sandboxed** (popups and banners are). The SDK puts their `<style>` in
  `document.head` and clones their HTML into the target, so their CSS leaks page-wide unless every
  selector is namespaced under the creative's root id.
- **A top sticky bar takes the same pixels as a fixed header.** The page must measure and publish
  the banner height and the header's bottom edge as CSS variables (`--dn-banner-height`,
  `--dn-header-clearance`), found by shape (fixed, top-anchored, near full width, short, two levels
  deep under body) via a `MutationObserver`, and accept a height the bar itself reports over
  `postMessage({dnBanner: 'height', px})`, clamped. A bar rendered inside a full-viewport iframe
  cannot be measured from outside; only the bar knows its height.

Theming of shared creatives: the 17 shared popup creatives render in cross-origin iframes and ask
the host page for its theme. The page answers:

```js
window.addEventListener('message', function (event) {
  if (!event.data || event.data.dnTheme !== 'request' || !event.source) return;
  event.source.postMessage({ dnTheme: 'reply', theme: THEME }, '*');
});
// THEME keys used: primary, onPrimary, accent, ink, muted, surface, page, line, tint, radius,
//                  brandText, shadow, displayFont, bodyFont
```

The demo's own on-site engine (`creatives.js`): each experience carries a rule that runs on page
view, dwell (3 second sweep, waiting out the rule's own `after`), scroll depth (with a minimum
dwell) and exit intent. Guards: one on screen at a time, a 25 second cooldown between automatic
appearances, once per session per rule, or once per visitor where the message only makes sense
once (stored in `localStorage`). Every appearance and every non-close action writes a reporting
row. A `?onsite=panel` switch hands the same experiences to Dengage (the launcher fires the
`<brand>_demo_` event, the local rules stand down) and `?onsite=local` puts it back, remembered per
browser. It is a switch rather than a race so a popup on screen has one explainable origin.

#### 3.9 Quick reference values a presenter needs

The launcher's Quick reference panel shows: device id, session id, push token, contact key, the
demo page URL (origin + pathname, query stripped, the exact string to filter `page_url` on),
account id and app guid, each with a copy button.

- `getDeviceId` and `getToken` are callback style (decoded from the bundle's action table).
- **There is no `getSessionId`.** The SDK keeps the session in `localStorage['_dn_sessions']` as
  JSON with a `sessionId` field. Read it defensively and show a dash if the key changes.
- Settle the panel with a 1.2 second timer, because either callback may never fire.

#### 3.10 The `?debug=1` readout

Fixed panel, bottom left, newest first, bounded to 40 rows, collapsible, copy-as-JSON. Three row
kinds: an event the page sent (action, table, payload, `accepted` flag), a request to a
`dengage.com` host (method, host, path, HTTP status or "no response, reason"), and a message
outcome (moment, what Dengage answered for email and push, the personalization keys that
resolved). `?debug=1` remembers itself in `sessionStorage` so it survives navigation; `?debug=0`
forgets. It calls the SDK for nothing; it listens to `dps:<slug>:event` and
`dps:<slug>:confirmation` and watches the transport.

---

### 4. Panel content contracts

#### 4.1 Custom HTML on-site campaigns

Settings that were not style choices: content type **Custom HTML**, trigger **Data Layer Event**
with the exact event name (or a native trigger), **Where to display** = path prefix, **Active**,
**Show every X minutes** 1, **Max show count** 100, **Layout** popup with a width (420 to 440
worked) or sticky bar top/bottom, **Design: padding 0 and transparent background** (or the engine
draws its own white box around the card), popups take the engine's close button via **Layout >
Close Button > Add close button to outside**.

Authoring rules: paste the **whole file**, doctype to closing tag (each committed creative carries
its own panel settings in a comment at the top). **No `<script>` tags: the panel strips them on
save**; behaviour goes in `onclick` attributes. Links carry `target="_top"`. Imagery is absolute
URLs to the published origin. Namespace every CSS selector under the creative's root id. Inside the
engine iframe a `Dn` object exists:

```
Dn.postSubscription()               submit the native subscription form
Dn.postQuestion()                   submit the native question form (writes a contact tag)
Dn.setTags([{tag, value}])          write tags directly
Dn.sendClick('<label>')             record a named click for campaign reporting
Dn.closePopup()                     close
Dn.postMessageToParent('postSubscription', {form: {...}})   lower level fallback
```

#### 4.2 The native subscription form contract (creates or updates a contact from the engine)

The engine injects its form handler **only when the stored content contains the exact text**
`data-dn-form-id="subscription_form"`. Skeleton:

```html
<form class="form" data-dn-form-id="subscription_form" data-dn-validation-language="en" id="x" onsubmit="return false">
  <div class="container">
    <input type="email" data-dn-id="email" data-dn-type="EMAIL" data-dn-required="true">
    <span data-dn-invalid-message-type="EMAIL"></span>              <!-- pairs with the field BY INDEX -->
    <input type="checkbox" checked data-dn-id="emailPermission" data-dn-type="PERMISSION_CHECKBOX" data-dn-required="true">
    <span data-dn-invalid-message-type="PERMISSION_CHECKBOX"></span>
    <button type="button" onclick="Dn.postSubscription(); Dn.sendClick('x__subscribe');">SIGN ME UP</button>
    <div class="submitted-content" style="display:none" data-dn-is-enabled="true"
         data-dn-is-modal-auto-close-enabled="true" data-dn-modal-close-seconds="6">Thank you</div>
  </div>
</form>
```

The engine stamps `data-dn-invalid="true"` on a failing field and `data-dn-is-submitted="true"` on
`.container` when the post succeeds; CSS shows the thank-you block from that attribute. Verify a
capture against a **stored contact**, not a closed popup. Identify the device with a `DPS-` key
*before* the trigger fires, or the engine mints an `sf_` key (section 3.2).

#### 4.3 The native question form contract (writes a segmentable tag)

Same mechanism with `data-dn-form-id="question_form"`. The first `.form-block` carries
`data-dn-name="<tag_name>"` (the contact tag the answer is written to), `data-dn-min-selection`,
`data-dn-max-selection`, and **`data-dn-is-radio="true"` for radio options**: without it the engine
validates in checkbox mode, counts zero checked checkboxes among radios and refuses every answer
with the "at least 1 and at most 1" message. `Dn.postQuestion()` validates, writes its own text into
`div.form-message`, and stores the answer as a tag the panel can segment on. Survey and NPS cards
post tags; tags attach to whatever the device already is, so they never mint a contact.

#### 4.4 The shared on-site library already live on the account

Fired as `dengage_demo_<slug>`, brand neutral, display rules already cover the demo paths. Slugs
must not be renamed:

| Group | Slugs |
|---|---|
| On-site messaging | `subscription-popup` (creates a contact), `survey`, `nps-popup`, `image-popup`, `horizontal-popup`, `cta-image-popup`, `sticky-bar`, `image-bar`, `slide-in`, `vertical-popup`, `story` (panel-drawn), `exit-intent` (native gesture), `scroll-depth` (native gesture) |
| A/B testing | `ab-test` |
| Gamification | `spin-to-win`, `scratch-card`, `countdown-to-win` |
| Inline personalization | `inline-below-header`, `inline-below-hero`, `inline-in-grid`, `inline-pdp-below-price`, `inline-above-footer` (each renders only where its slot exists; the launcher refuses elsewhere) |
| Actions (SDK, not a trigger) | web push prompt, inbox open |

Brand one-offs built for Nissan (`nissan_demo_*`, ten of them: invite, exit-intent rescue, finance
bar, two seasonal offers, launch bar, arrival-alert capture, newsletter capture, welcome-back,
scroll-depth survey) are in `panel/creatives/` as reference implementations of popup, bottom bar,
top bar, capture form and question form. The same ten are also drawn by the site itself so the
demo runs with nothing pasted.

Parked, not built: **model-aware (dynamic) popups** two ways, display-rule variants per product
path, or **Dynamic Content template-tag creatives** reading the visitor's history and a product
table per contact, the way the shared ecommerce abandoned-cart card does on this account. Also
parked: the **recommendation widget** card (slot kept). Both are the obvious next capabilities for
a marketplace.

#### 4.5 Push, SMS and inbox content in the composer

Built in **Content > Push (platform Web)**, **Content > SMS**, and inbox content, never as HTML.
Fields: Content Name, Title, Message, Target URL, Media (optional image), Icon; SMS has Sender Name
from the account dropdown (**a sender id is needed for live SMS**; the account state should be
checked) and a body inside one segment with a STOP opt-out. Keep a push title under about 50
characters and a message under about 120 or a phone truncates it. Naming used: `D.auto - Push -
<moment>`; the panel folder convention is `<D.brand> - <channel> - <moment>`.

**Template tags work in push Title, Message, Target URL and Media**, so one content serves many
products and two brands: `{%= $Current.model %}`, `{%= $Current.model_image %}` in Media (a tag,
not an upload), `{%= $Current.booking_url %}` as Target URL. Any address typed into a shared
content belongs to one demo only; a tag is the fix (a Nissan visitor tapping a shared push landed
on the Lincoln storefront until the Target URL became `{%= $Current.contact_url %}`).

Transactional push contents already authored in the account (public ids, reusable because the copy
names no brand; only the values change): booking `34a70f7e-4671-4ed9-a482-ae78e5308188`,
abandoned `7a1aa595-ff4c-498a-b032-c9b11954ab69`, quote `4bd7ad89-547f-40bc-aef5-d81cf46b9473`,
brochure `6ccb441d-9513-4d4f-a852-99debe03362d`, newsletter `f8672856-8a11-4d4f-92ab-e036739e2423`
(Lincoln) and `50fdb66e-d894-4f6a-b4ce-da9a4a850e91` (Nissan), survey
`dd33859f-3f41-49ec-86ba-0f42dbf5397f`, reserve `89cd42ba-f865-45c6-9199-ede892c20de5`, walk-in
`9fa61c0c-e033-4644-977f-b6198bb6e759`, test-drive-done `818a45fa-da5e-4846-9fca-0e41ba159cc7`,
inbox message `31aab9e8-1aa8-4ddd-9346-58d06e1f5a2d`, no-show `e974aaf2-4b7c-409c-8a57-91565a226bf3`.
Their copy is automotive; a new industry authors its own but the mechanism is identical.

#### 4.6 Email content and the template language

The panel's template language, as used and verified in live sends:

```
{%= $Current.field %}                        print a value sent in the API call
{%= $Current.field || 'fallback' %}          print it, or this when empty
{% if ($Current.field) { %} ... {% } else { %} ... {% } %}   conditional block
{%= $Contact.name %}                          a contact column (EMPTY in a transactional send)
{{unsubscribe-link}}                          the unsubscribe URL
```

**A transactional send can only see `$Current`**, the values passed in the call; `$Contact` tags
stay empty. Everything a message prints therefore travels in the API call. Values used in a title,
Target URL or Media field must be sent every time (a hole there is the first thing a visitor
sees); everything else prints only inside a condition, because a city or a store has no honest
stand-in.

Authoring pattern that held up: a generator script emits every email body per brand from one
data structure (one frame, one palette per brand taken from that storefront's stylesheet, same
tags in the same order), 520px table layout, hero image from `{%= $Current.<image> %}`, a detail
table where each row prints only when its value was sent, one CTA, a footer with the Dengage mark,
a demonstration notice and `{{unsubscribe-link}}`. The panel preview cannot resolve `$Current`, so a
throwaway `_tag-check.html` content that prints every value in brackets, fired once at yourself,
settles which tags resolve before a dozen templates depend on it. A renderer (`preview-emails.mjs`)
substitutes the two constructs, renders each body twice (all values given, and only the always-sent
values), and reports any tag it could not resolve.

Emails are never shared between brands (they carry a brand name and a footer); pushes are.

---

### 5. REST API, server side, exactly as called

All calls: `POST` JSON to `https://api.dengage.com/rest<path>`, header
`authorization: Bearer <token>` except `/login`. Timeouts of 8 to 15 seconds were used.

#### 5.1 Login and token cache

```
POST /login   { "userkey": "...", "password": "..." }
 -> { "access_token": "...", "expires_in": 3600 }
```

Cache the token until a minute before expiry; logging in before every call is wrong per Dengage's
guidance. Rate limits to respect: **30 requests per second per IP**; **bulk upsert is meant to be
called about once a minute**.

#### 5.2 Contacts

```
POST /bulk/contacts
{
  "columns": ["contact_key","name","surname","email","email_permission","gsm","gsm_permission","city"],
  "contactDatas": [ { "contact_key": "DPS-1", "name": "...", "email_permission": true, ... } ],
  "insertIfNotExists": true,
  "throwExceptionIfInvalidRecord": false
}
 -> { "code": 0, "message": "...", "data": { "inserted": [...], "updated": [...], "errors": [...], "warnings": [...] } }
```

The result arrays sit under a `data` envelope (the relay mislabelled every insert as an update
until it read the envelope). An unknown column makes the record fail; the relay retries with only
the core columns and records why. Permissions come from the form's own consent checkbox
(`email_permission`, `gsm_permission`). `city` exists on `master_contact` already.

```
GET /contacts/{contact_key}?contactFields=contact_key,name,surname,email,gsm,city
 -> { "data": { "contacts": [ {...} ] } }
```

Contact import template columns (the manual Audience alternative, `panel/personas.csv`):
`contact_key, contact_status, email, email_permission, email_status, gsm, gsm_permission,
gsm_status, name, surname, gender, birth_date, segment, source, subscription_date, rfm_score,
rfm_segment, rfm_mobile_score, rfm_mobile_segment, gsm_source, email_source, gsm_consent_date,
email_consent_date, contact_type`.

**Demo owner decision (30 August): no custom columns on `master_contact`.** Identity and
reachability live on the contact (name, surname, email, mobile, consent, city). Behavioural
answers (preferred product, purchase horizon, title) stay on related rows keyed by the same contact
key (the custom event table and the backend's own lead table), and segmentation reaches them
through the relation. Reversing that is one line in the relay plus the matching contact columns.

#### 5.3 Transactional email

```
POST /transactional/email
{
  "send": { "to": "name@example.com", "toLanguage": "EN" },
  "content": { "templateId": "<email content public id>" },
  "current": { ...every value the template may print... },
  "reporting": { "trackOpen": true, "trackClick": true },
  "tags": ["demo", "<brand>", "<moment>"]
}
```

#### 5.4 Transactional push, by contact or by token

```
POST /transactional/push                       # by contact
{
  "contentId": "<push content public id>",
  "contactKey": "DPS-...", "appId": "<appGuid>", "sendToAll": true,
  "language": "EN",
  "current": { ... }, "customParameters": [ { "key": "...", "value": "..." } ],
  "inboxParams": { "enabled": true, "expire": { "type": "PERIOD", "period": 30, "periodType": "DAY" } },
  "tags": ["demo", "<brand>", "<moment>"]
}
POST /transactional/push                       # by device token (anonymous or unbound device)
{ "contentId": "...", "token": "<device token>", "appId": "...", "language": "EN",
  "current": {...}, "customParameters": [...], "inboxParams": {...}, "tags": [...] }
```

- The push API takes **no inline title or body**: every word comes from the saved content,
  personalized through `current` and `customParameters` (send both so content built either way
  resolves).
- **Every transactional endpoint answers HTTP 200 for a refusal as well as a send.** The outcome is
  in the body: `{ transactionId, code, message, data }`; `code 0` is Successful. `code 11` is
  `Token not found with given ContactKey`, the normal state for a device that has not claimed the
  contact, and the one refusal worth retrying by token. Reading `res.ok` reported refused pushes as
  sent until 1 September 2026.
- **The API user needs permission for the transactional API**; without it both endpoints answer
  `403` with an empty body.
- `inboxParams` are correctly shaped and cost nothing, and in this account they put nothing in the
  App Inbox (section 3.7).
- Dengage refuses an unknown template id, so a `sent` with code 0 proves the content id is real.

#### 5.5 Data Space read (row counts)

```
GET /dataspace/tables?limit=1000&offset=0
 -> { "data": { "result": [ { "tableName": "...", "publicId": "..." }, ... ], "totalRowCount": N } }
GET /dataspace/tables/{publicId}
 -> { "data": { "totalRowCount": N, ... } }
```

The listing is paged and the account holds far more tables than a demo's; walk until found.
**Seven simultaneous reads trip the rate limit** (the seventh came back 429 every time); back off
500ms per attempt and retry up to three times.

#### 5.6 Other doors known but not used

`POST /dataspace/triggerAutomatedFlow` starts a flow carrying an API trigger step. Transactional
SMS exists beside email and push. Same login, same IP rules.

#### 5.7 Account-side prerequisites and the egress IP problem

1. **Create an API user**: Settings > Users, the API user type (not a panel login). Its userkey and
   password become server secrets. Grant it the transactional API permission.
2. **Allowlist an egress IP**: Settings > Identity & Access Management > API IP Restriction > Add
   (single IP or range, name it, Save); applies in about five minutes.
3. **Supabase Edge Functions have no static egress IP** (stated in Supabase's docs and measured 30
   August 2026: five consecutive calls left from five addresses, and Dengage refused a sixth before
   any credential was checked). Whitelisting an observed address cannot hold. The chosen fix: a
   small Ubuntu VPS with a dedicated IPv4 running an authenticated CONNECT proxy (tinyproxy,
   `ConnectPort 443` only, BasicAuth, ufw allowing SSH and the proxy port). `tools/vps-egress-setup.sh`
   installs it and prints the address to allowlist and the secret
   `DENGAGE_EGRESS_PROXY=http://user:pass@ip:8642`. In Deno the proxy is used per fetch:

   ```ts
   const client = Deno.createHttpClient({ proxy: { url: 'http://ip:port', basicAuth: { username, password } } });
   await fetch(url, { method, headers, body, client });
   ```

   TLS stays end to end. If the rental lapses the relay degrades to store-only and no lead is lost.
   Alternatives considered: a hosted static-IP proxy (QuotaGuard class, same secret), or allowlisting
   provider ranges (the relay's pool is AWS us-east-1; the five blocks that covered every observed
   call were 3.224.0.0 to 3.239.255.255, 44.192.0.0 to 44.223.255.255, 100.48.0.0 to 100.63.255.255,
   18.232.0.0 to 18.235.255.255, 13.216.0.0 to 13.223.255.255, and the pool drifts).
4. **In production none of this exists**: the brand's backend has a fixed IP, and that is the
   integration story told to a prospect.

---

### 6. The stand-in backend: five edge functions and their pattern

All are Deno `Deno.serve` functions under `supabase/functions/`. Shared shape: CORS allowlist of
the published origin and `http://localhost:8101`; `OPTIONS` answered 204; per-IP rate cap over a ten
minute window (30 for the relay, 20 for the sender, 10 for peek, 5 for seed) keyed on
`x-forwarded-for`; every input `clean()`ed (trim, max length, type checked); `DPS-` key shape
enforced; a `GET` on the function URL is a **health line** that reports configuration state and
never a secret value. Public by design like any form handler; a token shipped in a public page is
not a secret, so validation and caps are the defence.

| Function | Method | What it does |
|---|---|---|
| `nissan-lead-relay` | POST | Receives a typed lead (`contact_key, title, name, surname, email, gsm, model, city, purchase_horizon, form, page_url, utm_source, utm_medium, utm_campaign, marketing_consent`). **Stores it first** in its own `*_web_lead` table with `dengage_status: received`, then logs in and upserts the contact via `/bulk/contacts`, then patches the row with `dengage_status` (`contact inserted` / `contact updated` / `rejected` / `error HTTP n` / `pending api user`) and `dengage_detail` (raw answer). Normalizes the local mobile format to the country code (digits only, never invents digits). Accepts `form` from a fixed set. Needs email or phone. GET reports `egress_ip` (via api.ipify.org through the proxy), `egress_proxy_configured`, `api_user_configured`, `api_base`. |
| `nissan-booking-confirm` (the message sender) | POST, GET | POST `{brand, moment, contact_key?, device_token?, name, surname, email, gsm, model, model_id, city, branch, purchase_horizon, note, booking_ref}`. Resolves the content ids for the brand and moment (env var overrides, committed defaults as the record of what is wired), derives every product value **server side from the id** (name, category, figure, page URL, image URL, form URL, contact URL) so a request cannot inject text or links, sends the email if an address and an email content exist, sends the push by contact with a fallback by token on code 11, writes a row to the demo's own inbox with the channels that carried and Dengage's raw replies in `detail`, and for a booking patches the lead row with `tx_email_status`, `tx_push_status`, `tx_detail`. Answers `{brand, moment, email, push, inbox, personalized: [keys]}`. GET with no params lists every moment and whether email and push content are configured per brand; GET `?inbox=<key>&device=<token>` returns the message centre rows for the drawer (`smsgId: 'demo-<id>'`, `title`, `message`, `mediaUrl`, `targetUrl`, `sentDate`, `channels`, `moment`), token filtered to `^[A-Za-z0-9:._-]{20,400}$` and dropped rather than escaped. |
| `nissan-dengage-tables` | GET | Read-only whole-table counts for a **fixed list of seven tables** (no table name accepted from the caller), parallel reads with 429 backoff. |
| `nissan-persona-seed` | POST | Idempotent upsert of eight fixed personas into `master_contact` with name, surname, email, mobile, city and consent; reads DPS-1 back as proof. Reads nothing from the caller. |
| `nissan-contact-peek` | GET `?key=` | Reads one `DPS-` contact back from `/contacts/{key}` so a stored contact is confirmed from the wire. Requires the project key (JWT verified by the platform). |

Secrets (Supabase dashboard > Edge Functions > Secrets), all read at runtime:
`DENGAGE_API_USERKEY`, `DENGAGE_API_PASSWORD`, `DENGAGE_API_BASE` (default production),
`DENGAGE_EGRESS_PROXY`, `DENGAGE_APP_ID`, one `DENGAGE_TX_EMAIL_*` and `DENGAGE_TX_PUSH_*` per
moment (brand suffixes where a brand has its own), plus the platform's `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Setting a secret: `supabase secrets set NAME=value --project-ref <ref>`.

Sequencing on the page that the functions rely on: the lead relay is called first (the contact
must exist before a push can be addressed to it) and the message sender follows **when the relay
settles or after 2.5 seconds, whichever comes first, once** (`once(promise, ms, fn)`); a slow relay
must not cost the visitor their confirmation. The lead path never depends on messaging; a refused
send costs the lead nothing.

---

### 7. Remote Data Source: Postgres as the segmentation source

#### 7.1 Connection fields (Data Space > Remote Data Sources > New, type PostgreSQL)

| Field | Value used |
|---|---|
| Host | `db.raextqlludkagdntyzwn.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| Schema | `public` |
| User | `dengage_reader` |
| Password | set out of band, never in the repository |
| SSL | required |
| Pooler alternative if the panel cannot open a direct connection | host `aws-0-ap-northeast-1.pooler.supabase.com`, port `6543`, user `dengage_reader.raextqlludkagdntyzwn` |

#### 7.2 A dedicated read-only role

```sql
create role dengage_reader with login nosuperuser nocreatedb nocreaterole noinherit;
grant usage on schema public to dengage_reader;
grant select on <each demo table> to dengage_reader;
create policy dengage_remote_read on <each demo table> for select to dengage_reader using (true);
create or replace view v_x with (security_invoker = true) as ...;   -- views stay filtered by RLS
grant select on v_x to dengage_reader;
```

**The silent failure**: tables with row level security enabled and no policy connect fine,
authenticate fine, and every query returns zero rows. A remote source wired that way tests green
and every segment built on it is empty. One read-only policy per table for that role fixes it, and
every new table will have the same trap. Views are created with `security_invoker = true` so they
cannot bypass RLS.

#### 7.3 The rule that decides what can be a remote table at all

**A remote table has to relate to `master_contact` or `master_device`.** Established from the panel
on 2 September 2026. Every row therefore needs a contact key. A table about places or products
(a branch list, a stock table, a stock-gap view) is simply not offered, with no error. An earlier
diagnosis blamed a composite primary key and added a surrogate `stock_id`; no key shape could have
helped. The fix is to reshape the fact around the person: a view with one row per contact that
carries the product they want, the location they dealt with, whether it is available there, and
where it is available instead (a "here is where it is waiting" segment rather than an apology).

#### 7.4 One flat view per segment

The panel builds segments over a single remote table at a time, so joins live in the database and
the panel sees flat tables. Pattern used: a `v_<brand>_contact_360` view merging web leads,
offline events and the existing customer base on `contact_key` with `known_both_sides`,
`last_web_site`, `purchase_horizon` coalesced across sources; then narrow views (hot leads,
no-shows with a `not exists` guard against later stages, open quotes with `days_since_quote`,
upgrade candidates with `years_owned`, dealer-scoped leads, contact-keyed stock). Named filters
(`days_since_quote >= 14`, `known_both_sides = true`, `in_stock_for_them = false`) become the
segments a story asks for. The seed is deterministic (`setseed`) so quoted segment sizes are exact,
every value announces itself as invented (DEMO ids, 555-block mobiles, `DPS-` keys), and the eight
presenter personas are engineered rows that match the simulator line for line.

#### 7.5 The demo's own inbox tables

```sql
create table ni_inbox_template (brand text, moment text, title text, body text, updated_at timestamptz, primary key (brand, moment));
create table ni_inbox (id bigint identity, contact_key text, device_token text, brand text, moment text,
                       title text, body text, media_url text, target_url text, channels text, detail text,
                       sent_at timestamptz default now());
-- indexes on (contact_key, sent_at desc) and (device_token, sent_at desc)
```

Placeholders in braces (`{model}`) are filled with the same send parameters the email and push use;
copy is editable with one `update` and no deploy; `detail` holds Dengage's per-channel reply and is
never returned to the browser. One query over `ni_inbox` for the last hour tells a refused push, a
push by contact and a push by token apart, which is the first thing to read when a notification
does not appear.

---

### 8. Data model, industry neutral

| Where | What lives there | Why |
|---|---|---|
| `master_contact` (Dengage) | identity and reachability: key, name, surname, email + permission, gsm + permission, city | the relational split, demo owner's call |
| Six standard event tables (Dengage) | browsing, cart, order, cancel, wishlist, search | the SDK's own funnel, shared with every property on the account |
| One custom event table (Dengage Data Space) | every business moment with no standard column, typed by `event_type`, with source and free `note` | written from the browser via `sendDeviceEvent`, segmentable |
| Contact tags (Dengage) | survey and NPS answers from engine question forms | segmentable, attach to the device's contact |
| Backend lead table (Postgres) | every typed lead with UTM/click id, consent, Dengage status and detail, transactional outcome | the audit trail an HTTP 200 cannot give |
| First-party and offline tables and views (Postgres, remote source) | customer base, offline events, per-contact availability | what makes the "composable CDP" claim checkable |
| Own inbox tables (Postgres) | instant message centre | the App Inbox cannot answer the moment |

Campaign attribution: capture `utm_source`, `utm_medium`, `utm_campaign` on **arrival**, first
touch wins, stored in `localStorage`; a bare `gclid` reads as `google`, a bare `fbclid` as
`facebook`, because real ad traffic often survives a redirect chain with nothing else. Every lead
posted to the backend carries it, two pages and three clicks later.

---

### 9. The demo UX layer, component by component

- **Launcher** (floating button, modal): grouped cards for brand experiences, the shared library,
  A/B test, games, inline slots, push prompt, inbox open, and presenter shortcuts (simulator and
  console open in new tabs so the storefront keeps its session). Each card prints what it fires or
  why it cannot here. Everything fires twice in a row without going dark.
- **Event panel**: a fixed dropdown of storefront events (no free-text table field anywhere), each
  entry naming the table it writes; fires with a sample product and the current cart lines.
- **Quick reference** and **reset widget display state** (section 3.8, 3.9).
- **Bell and drawer**: unread badge, refresh, merged list, media column reserved for the whole list
  or none, broken image handling, open in a new tab (never navigate the shared screen), dismiss.
- **Debug readout** (`?debug=1`).
- **Own on-site engine** with behavioural rules, guards, reporting rows, `?onsite=panel|local`.
- **Persona switch** `?ck=DPS-n` and eight seeded personas that exist in the contact table, the
  Postgres dataset and the simulator alike.
- **Offline signal simulator** ("dealer cockpit"): a tablet-style page standing in for a store
  system, a call-centre screen and a partner webhook. Choose a persona (which `setContactKey`s the
  browser), choose a product, press a signal. Each button writes a real custom-table row, some also
  write a real order or cancel, and three raise a moment through the message sender. It recognizes
  a real website visitor (a minted key, not a seeded persona) and sends them the details they typed
  so the follow-up lands by email too. It dispatches the same confirmation event as the storefront
  so `?debug=1` shows its sends.
- **Verification console** (`verify/`): loads no part of the demo (a verification tool that fires
  its own page view appears in the numbers it reports). Reads the message sender's health GET and
  the counts endpoint with a baseline stored in `localStorage` and a delta column.
- **Profile made visible** ("My Showroom"): the customer-facing half of the contact card, drawn
  from the same signals the panel segments on, working while nobody knows their name.
- **Forms**: the demo owns validation (only visible required fields), prefills every later form
  from what the visitor already gave, mints identity on submit, posts to the relay, fires the SDK
  events, asks for the message, and repeats back exactly what was typed with empty fields left out.
- **Mobile**: menu drawer transform reset, an invisible fixed bar that swallowed taps, 44px tap
  targets without widening the row, a manifest per demo, and a check that presses things and asks
  whether the opened box is inside the viewport.

---

### 10. Verification and tooling that proved things

| Tool | What it proves | Reaches Dengage? |
|---|---|---|
| `tools/verify.mjs` (44 assertions), `tools/verify-lincoln.mjs` (55) | static: no dead internal refs, no em/en dashes in published HTML, message images exist and are large enough; browser: every page boots clean and fires `pageView` first, launcher renders 30+ cards, every self-drawn creative draws twice and raises no data layer event, `?onsite=panel|local` behaves, funnel events fire in order, quote never writes an order, empty submits are held, variant ids stay distinct, cart add/remove/delete coverage, cancel names its order, readout present, rescue and survey ask for their messages | No. Refuses `dengage.com` and asserts the refusal, so it never writes into the shared account |
| `tools/rehearse-nissan.mjs`, `tools/rehearse-lincoln.mjs` | walks one visitor through the whole lifecycle on the published address (bytes served locally, Dengage and the functions called for real, everything else refused), reports what Dengage answered per channel and whether the always-sent values resolved, counts asked versus answered sends by moment | Yes. Sends no email unless `--email` is given (an invented address bounces on the shared sending reputation) |
| `tools/audit.mjs`, `tools/audit-lincoln.mjs`, `tools/audit-mobile.mjs` | every visible control is answered (`data-dps-wired` and friends), every visible image decodes, no horizontal scroll at a phone viewport | No |
| `tools/mobile-check.mjs` | presses the hamburger, launcher, bell, a product card and the form submit on iPhone 13 and Pixel 7 emulation and asserts the opened box is inside the viewport and tap targets are 40px or more | No |
| `tools/preview-emails.mjs` | renders every email body twice and reports unresolved tags | No |
| Counts endpoint, health GETs, `ni_inbox.detail` query, `curl` of the loader URL, `grep -c <prefix>_demo_` on the on-site campaign manifest the loader names | live state without opening the panel | Read only |

Capture and build pipeline (Python, beautifulsoup4 and pillow at build time only):
`hydrate-dump.mjs` renders source pages in Chromium and saves the hydrated DOM and screenshots;
`download-assets.py` mirrors every stylesheet, font and image from allowlisted hosts, compresses,
rewrites `url(...)`, writes a manifest; `build-pages.py` strips scripts and trackers, removes
furniture a static demo cannot honour, rewrites assets and links, contains every link inside the
demo, swaps the brand logo for the Dengage mark, stamps `data-demo-slug`, `data-rel-root`,
`data-site-path` on `<html>` and `data-page-type`, `data-product-id`, `data-price`,
`data-category-path`, `data-promotion-id` on `<body>`, injects the head block, the mounts and the
five slots, adds the demonstration notice, and restamps hand-written pages with the same cache
stamp (`?v=<epoch>`); `extract-grades.py` pulls embedded product variant data; `prune-assets.py`
removes unreferenced mirrored assets. The capture (`reference/`) is gitignored.

Standing rule from the run of show: **a journey unverified by rehearsal is shown as its canvas,
plainly, never presented as a working automation.** It has never cost a meeting.

---

### 11. Gotcha catalogue, terse

Identity and events
1. Pass the contact key to `initialize`; setting it later loses the first page view.
2. `setContactKey` with an unknown key creates a contact. Validate the `DPS-` shape at the call site.
3. Engine capture forms mint `sf_<uuid>` contacts unless the device already has a key.
4. Every page fires `pageView` first, or its rows belong to no demo.
5. Namespace all storage by slug; two demos on one origin otherwise share cart, wishlist and contact.
6. Omit unknown numbers; never send 0. `compact()` before every send.
7. `product_variant_id` falls back to `product_id`; distinct variants must keep distinct ids.
8. Remove before add when a selection changes; `cartItems` is the whole cart.
9. `beginCheckout` waits for an item; an empty abandoned cart cannot be personalized.
10. Custom tables must exist in the panel before rows are stored; sends are otherwise accepted and dropped silently.
11. `event_id`, `event_type`, `is_used` are required on `sendDeviceEvent` rows.
12. Storage lags about two minutes. HTTP 200 means accepted.
13. Only `page_url` finds a demo's rows; only `session_id` joins the tables.
14. Content blockers drop `event.dengage.com` while allowing `push.dengage.com`; watch the transport.

Push and inbox
15. `getToken` and `getDeviceId` are callbacks. Cache the token and refresh it every 30 seconds.
16. Token binds to the key that subscribed; setContactKey does not rebind. Fall back to push by token.
17. Code 11 is the normal state for an unbound device. Code 0 on a token send says nothing about delivery.
18. Transactional endpoints return 200 on refusal; read `code` in the body.
19. API user without transactional permission: 403, empty body.
20. iOS needs a manifest with `display: standalone` and Add to Home Screen. Print the steps.
21. macOS shows text-only notifications. Prove images on Windows or Android.
22. Blocked permission makes the SDK draw its own panel on every load. Set Allow or Ask before a call.
23. The App Inbox fills only from campaigns or journeys. `inboxParams` on a transactional push do nothing here.
24. The inbox is contact scoped; reading by device alone returns nothing.
25. The provider rejects with nothing when there is no device id yet; that is a timing state, not an error.
26. Never report impressions, opens or deletes for messages Dengage did not issue.

On-site
27. Fire both the data layer push and the window event with the same name.
28. Panel strips `<script>`; behaviour lives in `onclick`. Paste the whole file.
29. Padding 0 and transparent background, or the engine draws a white box.
30. `data-dn-is-radio="true"` on radio question blocks, or every answer is refused.
31. Inline creatives are not sandboxed; namespace their CSS.
32. A pinned top bar covers a fixed header; measure and publish the clearance, accept the bar's own height report.
33. Dwell rules must wait out their own delay or the first eligible rule fires at the first sweep.
34. Rules that read a flag must read the store the flag was written to (`sessionStorage` versus `localStorage` cost a rescue message that never fired).
35. A safety net that wires unwired buttons to the nearest link will wire your own button to the wrong link; mark self-wired regions and skip them.
36. Restamp hand-written pages when a module changes, or Pages serves yesterday's module from cache.

Server side
37. Supabase functions have no static egress IP; use a fixed-IP CONNECT proxy and allowlist it.
38. Cache the login token; respect 30 req/s per IP and roughly one bulk upsert per minute.
39. `/bulk/contacts` results sit under `data`.
40. Parallel Data Space reads trip 429; back off and retry.
41. Store the lead before calling Dengage; record the answer on the row.
42. Derive every product value server side from an id; never accept text or links from the page for a send.
43. Send the always-printed values every time; keep the rest inside conditions.
44. A shared content must contain only tags, never an address.
45. Rehearsals must not invent email addresses; bounces land on the shared sending reputation.

Remote data
46. RLS with no policy returns zero rows with no error. One read policy per table for the reader role.
47. Only tables relating to `master_contact` or `master_device` can be remote sources. Reshape facts around the contact.
48. Views with `security_invoker = true`, one flat view per segment.
49. Deterministic seeds make quoted segment sizes exact.

---

### 12. Channel coverage as proven on 2 September 2026

| Channel | State | How |
|---|---|---|
| On-site messaging (popups, bars, inline, games, A/B, story, survey, NPS, subscription) | Live | shared `dengage_demo_` library served by the engine; brand one-offs pasted or self-drawn |
| Web push | Live on the published origin, with rich image on Windows and Android | SDK subscription; transactional push by contact or token; campaign or journey |
| App inbox | Live, two sources | Dengage's inbox via the provider (campaign or journey fed) plus the demo's own message centre |
| Transactional email | Live | `/transactional/email` with panel HTML content and `$Current` tags |
| SMS | Composer field sheets written; live sends need a sender id on the account | Content > SMS |
| WhatsApp | Shown as a journey step and copy; live send via the partner's WABA (Value First) in production | not the Dengage composer |
| Journeys | Three designed (confirmation on `order_events`, abandoned checkout on `beginCheckout` without order, welcome on first identification) plus segment-entry follow-ups; shown as canvas unless rehearsed | Marketing tab |
| Segments | Over standard tables (`wishlist_events.list_name`), over the custom table, and over remote Postgres views | Data Space |
| RCS | Not offered. Say so if asked | |

---

### 13. What the automotive framing exercised, translated for a marketplace

Not a spec for the new project; a map of which capability each moment proved, so nothing is lost
when the vocabulary changes.

| Automotive moment | Dengage mechanism it proved | Marketplace equivalent |
|---|---|---|
| Model page view | `pageView` type `product` with product id, price, category path | product detail view |
| Choose a car on a form or a grade on the configurator | `addToCart` (with remove-before-add), custom row `configure` | add to cart, choose variant or plan tier |
| Details entered on the booking form | `beginCheckout` once an item is known | checkout started |
| Test drive booked or build reserved | `order` (real price, `payment_method: other`), lead relay, transactional email + push + inbox | order placed, subscription activated |
| Booking cancelled at the desk | `cancelOrder` naming the order | order cancelled, plan cancelled |
| Heart on a card / watch the price | `wishlist_events` lists `favorites`, `price_drop_alert` | wishlist, price alert, back-in-stock alert |
| Header search | `ec:search` once per settled query | catalogue search |
| Brochure download, finance calculator, compare, chooser | custom table rows with `note` and `purchase_horizon` | spec download, plan comparison, plan finder, eligibility checker |
| Newsletter and arrival-alert capture cards | engine subscription form contract, `Dn.postSubscription`, relay | newsletter, notify-me |
| Shopping survey | engine question form contract, contact tag | intent survey |
| Walk-in, call outcome, WhatsApp intent, sold | custom rows from a simulated store, call centre and partner webhook, three of them messaging | store visit, care call outcome, chatbot intent, churn or renewal |
| Existing owner base and stock per branch | remote Postgres views, contact-keyed availability | subscriber base, usage, device stock per store |
| Shop@Home, My Showroom | profile made visible from the same signals | account page, order history |

---

### 14. Numbers and identifiers worth having to hand

- Launcher card count asserted: 30+. Verify suites: 44 and 55 assertions. Rehearsal: 31 steps,
  about four minutes, roughly a hundred calls to Dengage and the functions.
- Storage lag: about two minutes. IP allowlist propagation: about five minutes. Drawer poll: 15
  seconds. Token refresh: 30 seconds. Creative cooldown: 25 seconds.
- Rate caps used on public functions: relay 30, sender 20, peek 10, seed 5 per IP per ten minutes.
- Content ids and the appGuid are public by design; API user credentials, the `dengage_reader`
  password and the proxy credentials are not in the repository.

---

### 15. Porting map: what to copy, what to adapt, what to rewrite

Copy verbatim (industry neutral, rename the slug and brand prefix only):

- `js/identity.js` (slug and contact key resolution, `mintKey`)
- `js/dengageEvents.js` (the single SDK surface; adjust the custom table name and the `LEAD_STAGES`
  list to the new industry's moments)
- `js/debug.js`, `js/slots.js`, `js/inbox.js` (drawer; strings via a copy table)
- `js/panels.js` (launcher; replace the brand card list and the event labels)
- `assets/css/demo-controls.css` (demo layer styling; reskin tokens)
- `supabase/functions/nissan-dengage-tables`, `nissan-contact-peek`, `nissan-persona-seed`
  (rename, change the table list and personas)
- `tools/verify.mjs` skeleton (SDK refusal harness, `dps:<slug>:event` listener),
  `tools/mobile-check.mjs`, `tools/audit.mjs`, `tools/audit-mobile.mjs`, `tools/preview-emails.mjs`
- `tools/vps-egress-setup.sh`
- `panel/creatives/newsletter-capture.html` and `shopping-survey.html` as the engine form contracts;
  `panel/nissan/_tag-check.html`
- `verify/index.html` (console; point at the new function names)

Adapt (structure reusable, content industry specific):

- `js/site.js` (form wiring, relay, `confirmBooking`, campaign capture, CTA routing)
- `js/creatives.js` (rules engine and guards reusable; the creatives and rule conditions are the story)
- `js/cockpit.js` (simulator shell reusable; personas, signals and moments are the story)
- `js/showroom.js`, `js/configure.js` (profile page and variant chooser patterns)
- `supabase/functions/nissan-lead-relay` (fields and forms list), `nissan-booking-confirm`
  (moments, brands, product table, image rules)
- `supabase/schema.sql`, `seed.sql`, `inbox-copy.sql` (role, RLS and view patterns; the tables are the story)
- `tools/build-message-content.py` (generator; moments and palette are the story)
- `tools/rehearse-nissan.mjs` (harness reusable; steps are the story)
- `panel/README.md`, `VERIFY.md`, `WALKTHROUGH.md`, `CONTENT.md` (the runbook shapes)

Rewrite from scratch: everything under `vehicles/`, `offers/`, the page map in `build-pages.py`,
the catalogue (`js/vehicles.js`, `js/grades.js`), the persona stories, all copy.

To extract the neutral kit from this repository into another checkout:

```bash
git archive --format=tar HEAD js/identity.js js/dengageEvents.js js/debug.js js/slots.js js/inbox.js \
  js/panels.js js/copy.js assets/css/demo-controls.css supabase tools verify panel/creatives \
  panel/nissan/_tag-check.html manifest.webmanifest .nojekyll | tar -x -C /path/to/new/repo
```

---

### 16. What this repository references but does not contain

- **`docs/`, `deck/`, `reference/`** are gitignored: internal presales material, the deck, and the
  raw capture (hydrated DOMs, screenshots, `assets-manifest.json`, `grades.json`). `verify.mjs`
  reads `reference/grades.json` and will fail without it.
- **The "demo factory"**: code comments cite `CLAUDE.md` non-negotiables, "Handoff 1.3 / 5.3 / 12.6"
  items, `factory/checks/*.mjs`, `factory/panel/live-campaigns.sh`, `boot.js`, `demo.config.json`,
  a reference build's `identity.js` and `productCatalog.js`. None of that is in this repository.
  The Nissan build baked `config.js` instead of fetching `demo.config.json`.
- **The push service worker** at the GitHub Pages origin root.
- **Secrets**: API user credentials, `dengage_reader` password, the VPS proxy credentials and
  address, the Supabase service role key.
- **Panel-side objects** that exist only in the account: the shared `dengage_demo_` campaigns, the
  `nissan_demo_` campaigns if pasted, the `ni_lead_events` table definition, the transactional
  contents (ids listed in 4.5 and in the sender's defaults), the API user and its IP allowlist, the
  remote data source connection, the journeys and segments.
- **The demo owner's standing decisions** recorded here but made verbally: no custom columns on
  `master_contact`; inbox delete not reported by default; model-aware popups and the recommendation
  card parked; a journey unverified by rehearsal is shown as a canvas.
