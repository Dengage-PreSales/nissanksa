# D-AUTO: what this repository is, and what is left to do

You are picking this up in a new GitHub account with none of the conversation
that produced it. This file is the whole context. Read it before changing
anything.

**What this is.** A working demonstration storefront called D-AUTO, built for
Dengage sales conversations in the automotive sector. It is a real site: real
pages, real events into Dengage, real messages, a real dealer cockpit, a real
verification console. Product data comes from the published Nissan Saudi Arabia
website and, for the second storefront under `/lincoln/`, from the published
Lincoln Saudi Arabia website. Nothing about it is mocked.

**Where it is going.** It was built at
`https://dengage-presales.github.io/nissanksa/`, against Dengage account 28,
which is shared with other demonstrations. It is moving to
`https://d-auto.pages.dev`, served by Cloudflare Pages from this repository,
against a new Dengage account dedicated to automotive.

**What has already been done.** Everything that could be done without the new
account existing. The site is at the origin root, branded D-AUTO, publishing
only the site rather than the repository, with the Dengage account reduced to
two values in one file.

**What is left.** Four things only, and three of them need a human.

---

## 1. The state you are inheriting

| | Before | Now |
|---|---|---|
| Origin | `dengage-presales.github.io/nissanksa/` | `d-auto.pages.dev` |
| Lincoln demo | `/nissanksa/lincoln/` | `/lincoln/` |
| Site brand | Nissan KSA x Dengage demo | D-AUTO |
| Dengage account | `28` baked into 47 pages | `0000` placeholder in 2 files |
| What is published | the whole repository | `dist/`, the site only |
| Launcher cards | 36, 22 of which needed another account's campaigns | 14, all of which act |
| Push service worker | in a repository we did not control | `dengage-webpush-sw.js` at this root |
| Capture material | ignored, so a clone could not rebuild | tracked |

Eight commits, each one self-contained. `git log` is the detail.

---

## 2. What is left to do, in order

### Step 1. Create the Dengage account and application (a human)

Create the automotive account, then a **web application** inside it whose
**Site URL is exactly `https://d-auto.pages.dev`**.

That value is not a label. The SDK bundle Dengage serves has the site URL
compiled into it, so an application created with the wrong one serves a bundle
that will not arm push, with no error anywhere on the page. If the domain
changes later, the application setting changes with it.

Note also that a new application generates a new VAPID key, so every device
that ever accepted push on the old demo has to accept it again. That is normal
and worth knowing before a rehearsal.

### Step 2. Allowlist the egress IP (a human)

Dengage's REST API accepts only allowlisted addresses. That is why the lead
relay tunnels its calls through a small proxy with a fixed IP: see
`tools/vps-egress-setup.sh`. The allowlist is **per Dengage account**, so the
same address has to be added again in the new one.

The decision on record is to reuse the existing proxy rather than build a new
one. Its address is in the `DENGAGE_EGRESS_PROXY` Supabase secret; nobody has
to read the secret to find the IP, the proxy host is the one the setup script
was run on.

**If this is missed the site looks completely healthy.** Pages render, forms
submit, `?debug=1` shows the send, and no message ever arrives.

### Step 3. Fill in the two values

```
js/config.js:29           accountId: '0000',
js/config.js:30           appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__',
lincoln/js/config.js:32   accountId: '0000',
lincoln/js/config.js:33   appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__',
```

Both files take the **same** pair. No page carries the account, so no rebuild
is needed: `js/config.js` starts the SDK itself.

While they are placeholders the SDK is deliberately not loaded at all, rather
than requested from a URL that would 404. The storefront works and nothing
Dengage fires. `tools/build-dist.py` refuses to build a publishable bundle in
that state, and refuses again if the account is `28`.

### Step 4. Set the Supabase secrets and deploy the functions

The Supabase project does not change: same project, same tables, same
`ni_*` data. What changes is which Dengage account the functions talk to.

Section 5 below is the full list. Set them in the Supabase dashboard, then
deploy the five functions in `supabase/functions/`. Their code is already
correct for the new origin and has not been deployed.

### Step 5. Connect Cloudflare Pages

The project already exists: account `Salil.gupta@dengage.com's Account`,
project `d-auto`, production branch `main`, no source connected, zero
deployments. Connect it to this repository with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `python3 tools/build-dist.py` |
| Build output directory | `dist` |

**The output directory is the part that matters.** Point it at the repository
root instead and the panel runbook, the demo walkthrough, the persona list and
the edge function sources are all served to anyone who types the path, which is
what happened on the previous host. A private repository does not prevent this;
the build output directory does.

---

## 3. Every placeholder, in one place

| File | Line | Value | Who fills it |
|---|---|---|---|
| `js/config.js` | 29 | `accountId: '0000'` | step 3 |
| `js/config.js` | 30 | `appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__'` | step 3 |
| `lincoln/js/config.js` | 32 | `accountId: '0000'` | step 3 |
| `lincoln/js/config.js` | 33 | `appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__'` | step 3 |
| `js/config.js` | 57 | `platformCards: false` | only after the shared campaigns exist |
| `lincoln/js/config.js` | 53 | `platformCards: false` | same |

Nothing else is a placeholder. Everything else in the repository is finished.

---

## 4. The launcher, and why it shows fourteen cards

Twenty two of the thirty six launcher cards fire a `dengage_demo_` event that
only the shared platform campaign library answers. That library lives in
account 28. In a fresh account those cards fire and nothing appears.

They are hidden by `platformCards: false`. The fourteen that remain all act
with nothing configured anywhere: ten experiences the storefront draws itself,
web push, the app inbox, the dealer cockpit and the verification console. The
Lincoln storefront offers ten on the same rule.

To bring them back: author the campaigns in the new account, then set
`platformCards: true`. In that order. `panel/README.md` section 2 has the
event names, the display rules and the creative files to paste.

---

## 5. The Supabase secrets

Thirty seven values. Five are infrastructure, thirty two are Dengage content
ids that only exist once the content is authored in the new panel.

### Infrastructure

| Secret | What it is |
|---|---|
| `DENGAGE_APP_ID` | the new application's app guid, same value as `js/config.js` |
| `DENGAGE_API_USERKEY` | the API user in the new account, Settings > Users |
| `DENGAGE_API_PASSWORD` | that user's password |
| `DENGAGE_API_BASE` | leave unset unless the account is not on production |
| `DENGAGE_EGRESS_PROXY` | unchanged, the existing proxy |

### Content ids

Two storefronts share this function and are told apart by the brand each page
sends. The **push content is shared**, because that copy names no dealer. The
**email bodies are not**, because they carry a brand and a footer.

The unprefixed names below are the shared defaults, which the Lincoln
storefront uses as they are. The `_NI_` names override them for the storefront
at the origin root.

| Moment | Email, shared | Push, shared | Email, root storefront |
|---|---|---|---|
| test drive booked | `DENGAGE_TX_EMAIL_CONTENT_ID` | `DENGAGE_TX_PUSH_CONTENT_ID` | `DENGAGE_TX_EMAIL_NI_BOOKING` |
| booking started and left | `DENGAGE_TX_EMAIL_ABANDONED` | `DENGAGE_TX_PUSH_ABANDONED` | `DENGAGE_TX_EMAIL_NI_ABANDONED` |
| quote requested | `DENGAGE_TX_EMAIL_QUOTE` | `DENGAGE_TX_PUSH_QUOTE` | `DENGAGE_TX_EMAIL_NI_QUOTE` |
| specification downloaded | `DENGAGE_TX_EMAIL_BROCHURE` | `DENGAGE_TX_PUSH_BROCHURE` | `DENGAGE_TX_EMAIL_NI_BROCHURE` |
| newsletter signup | `DENGAGE_TX_EMAIL_NEWSLETTER` | `DENGAGE_TX_PUSH_NEWSLETTER` | `DENGAGE_TX_EMAIL_NI_NEWSLETTER` |
| survey answered | `DENGAGE_TX_EMAIL_SURVEY` | `DENGAGE_TX_PUSH_SURVEY` | `DENGAGE_TX_EMAIL_NI_SURVEY` |
| build reserved online | `DENGAGE_TX_EMAIL_RESERVE` | `DENGAGE_TX_PUSH_RESERVE` | `DENGAGE_TX_EMAIL_NI_RESERVE` |
| walk in logged at the showroom | `DENGAGE_TX_EMAIL_WALKIN` | `DENGAGE_TX_PUSH_WALKIN` | `DENGAGE_TX_EMAIL_NI_WALKIN` |
| test drive completed | `DENGAGE_TX_EMAIL_TD_DONE` | `DENGAGE_TX_PUSH_TD_DONE` | `DENGAGE_TX_EMAIL_NI_TD_DONE` |
| booked but did not arrive | `DENGAGE_TX_EMAIL_NOSHOW` | `DENGAGE_TX_PUSH_NOSHOW` | `DENGAGE_TX_EMAIL_NI_NOSHOW` |
| a message waiting in the app inbox | none | `DENGAGE_TX_PUSH_INBOX` | none |

One push is overridden for the root storefront rather than shared:
`DENGAGE_TX_PUSH_NI_NEWSLETTER`.

The old account's ids are still in `supabase/functions/nissan-booking-confirm/index.ts`
as the code defaults. **They will not exist in the new account.** A moment
whose id is emptied reports that it needs content and sends nothing, which is
the safe state; a moment left pointing at an id from another account is not.

Check what is wired without opening the panel:

```
curl -s 'https://<project>.supabase.co/functions/v1/nissan-booking-confirm?health=1'
```

It returns every moment, which channels it can send on, the app id in use, and
whether the API user and egress proxy are configured.

---

## 6. Two questions that were deliberately left for you

Both were raised and deferred to this session on purpose. Neither blocks
anything.

### Internal identifiers

The demo's internal slug is still `nissanksa`. It appears in browser storage
keys (`dps:nissanksa:*`), reservation order ids (`DPS-nissanksa-res-<n>`), and
one visible URL, `/find-your-nissan/`.

The URL is the only one a prospect sees. The rest are invisible on a call, and
renaming them touches 165 references across 62 files, each one a chance to
break something, and orphans any storage on a device used before the change.

The recommendation on record: rename the URL if you care about the address bar,
leave the internals alone.

### The presenter personas

Eight Dengage contacts, `DPS-1` to `DPS-8`, with emails like
`ahmed.alrashid@nissanksa-demo.example`. They do not exist in a fresh account
and are recreated from `panel/personas.csv` or by the
`nissan-persona-seed` function.

The contact key is what `?ck=DPS-1` uses and what every document references.
The email is visible on the contact card during a demo, which is the only
argument for changing it.

The recommendation on record: keep the keys, change the email domain to
`@d-auto-demo.example` if the visible domain bothers you, and change both only
if you are willing to update the CSV, the seed function, the cockpit persona
picker and the walkthrough together.

---

## 7. How to check it works

Serve the built site rather than the repository, because the built site is what
ships:

```
python3 tools/build-dist.py          # refuses while the account is a placeholder
cd dist && python3 -m http.server 8102
```

Then, from the repository root:

| Check | What it proves |
|---|---|
| `python3 tools/test-rebrand.py` | the brand pass rewrites the owner and never the product |
| `python3 tools/test-build-dist.py` | the publish guard refuses every bad account state |
| `node tools/verify.mjs --base http://localhost:8102` | 44 assertions: every page boots with pageView first, the booking and quote funnels, the configurator, the cockpit, the finance calculator, the rescue and survey messages |
| `node tools/verify-lincoln.mjs --base http://localhost:8102` | 56 assertions, the same for the Lincoln storefront |
| `node tools/mobile-check.mjs --base http://localhost:8102` | 32 assertions, 16 each on iPhone 13 and Pixel 7, including the menu, the shortcuts and a full booking on a phone |
| `node tools/asset-sweep.mjs --base http://localhost:8102` | every request on every page, and what the server could not serve |

Once the site is live and the account is set:

```
node tools/rehearse-nissan.mjs --origin https://d-auto.pages.dev/ --campaign google --email you@yourdomain
node tools/rehearse-lincoln.mjs --origin https://d-auto.pages.dev/
```

Those run against the real account and send real messages, so use a real
address you own.

**An HTTP 200 from Dengage means accepted, not stored.** The row in Data Space
is the only proof an event landed. `/verify/` on the published site is the
console for that: take a baseline, use the demo, read again. Row counts arrive
in bursts rather than continuously, and one table has been seen to take twenty
minutes, so a count that has not moved after two minutes proves nothing yet.

---

## 8. Things that were already wrong before this work

Recorded so you do not spend an afternoon discovering they are not yours.

- **43 missing assets**, across all 48 pages. Fonts with working fallbacks and
  decorative images, referenced by captured vendor CSS that was never
  downloaded. Every one of them also 404s on the published site today.
  `node tools/asset-sweep.mjs` lists them.
- **The footer social column renders empty.** The links exist and are contained,
  but they are icon-font glyphs and that font never shipped with the capture.
- **`lincolnNaghiCookieConsent`** survives as a localStorage key inside
  `lincoln/assets/lincoln-build.js`. Invisible, and the only remaining trace of
  the source dealer's name.

---

## 9. Rules that still bind

1. **Never delete or truncate anything in Dengage.** Not a table, not a row,
   not a contact, not a campaign. Approval has to be in writing, for the
   specific object, before the call is made. The Data Space is shared with
   other live demonstrations and nothing here can be restored from this side.
2. **Account 28 keeps everything it has.** The move is additive. The old site
   stays live and untouched.
3. **Never fabricate a figure the source did not publish.** A model with no
   published price shows no price, not a zero. This is enforced in the
   catalogue and asserted in `tools/verify.mjs`.
4. **Nothing visible may be fake.** No dead links, no controls that cannot act.
   A control that cannot act is removed, not mocked.
5. **No em dashes and no en dashes** anywhere in this repository.
6. **Write everything here as product documentation.** Code comments, UI
   strings, commit messages. Internal notes go to the demo owner directly.

---

## 10. Where the detail lives

| File | What it covers |
|---|---|
| `panel/README.md` | everything with a counterpart someone clicks in the Dengage panel: the lead events table, the campaigns, the journeys, the remote data source, the event dictionary |
| `panel/WALKTHROUGH.md` | 53 steps, one buyer from a Google ad click to a car sold |
| `panel/VERIFY.md` | how to prove each capability, including push on a phone |
| `panel/CONTENT.md` | the copy for every message |
| `panel/creatives/` | the ten creative files to paste, each carrying its own panel settings |
| `reference/README.md` | the capture material and which build reads what |
