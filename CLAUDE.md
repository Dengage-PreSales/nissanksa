# D-AUTO: how to work in this repository

Read at the start of every session. If you are picking this repository up for
the first time, read [HANDOVER.md](HANDOVER.md) next: it is what is left to do
and why.

## What this is

A working demonstration storefront for Dengage sales conversations in the
automotive sector, published at `https://d-auto.pages.dev`. D-AUTO is a
fictitious dealership. Its product data is real, captured from the public
Nissan Saudi Arabia website and, for the second storefront under `/lincoln/`,
the public Lincoln Saudi Arabia website of Mohamed Yousuf Naghi Motors.

## The rules that do not bend

1. **Never delete or truncate anything in Dengage.** Not a table, not a row,
   not a contact, not a campaign, not a creative. Approval has to be in
   writing, in the conversation, for that specific object, before the call is
   made. Not afterwards, not because the object looks empty, not because you
   created it yourself five minutes ago. The Data Space is shared with other
   live demonstrations and nothing can be restored from this side. Reading is
   always fine: count rows, inspect a schema, report what you found, then stop
   and ask.

2. **Nothing visible may be fake.** No dead links, no controls that cannot act.
   A control that cannot act is removed, not mocked. If Dengage can do it,
   execute it through Dengage; if it cannot in this account today, say so
   plainly and show the canvas instead of staging it.

3. **Never fabricate a figure the source did not publish.** No price, no stock
   count, no performance number. A model the source publishes without a price
   carries none here. `Number(null)` is `0`, and that has shipped the same bug
   twice.

4. **Every page fires `pageView` first, and one module owns event emission.**
   `js/dengageEvents.js` is the only place that calls the SDK. A page that
   skips `pageView` writes rows that can never be attributed to this demo.

5. **No em dashes and no en dashes.** Commas, periods, colons, or rephrase.

6. **Write everything here as product documentation.** Code comments, UI
   strings, commit messages. Internal engineering notes and vendor
   correspondence go to the demo owner directly, never into a file here.

7. **The published site is `dist/`, never the repository root.** A static host
   serves whatever directory it is given, and this repository holds the panel
   runbook, the demo walkthrough and the edge function sources.

## How to work

**Verify in a browser, not by reading a diff.** A change that looks right in a
diff and breaks on screen costs a deal.

**Test a guard against known-bad input.** A guard that passes on the current
tree proves nothing. `tools/test-rebrand.py` caught two defects this way that a
green run would have hidden, and a third was caught only by loading the pages.

**A comment that states a fact about the environment is enforced by code, or it
is deleted.** An assertion that prints a number and calls it intended whatever
the number is, is a sentence, not a check.

**An HTTP 200 from Dengage means accepted, not stored.** The row in Data Space
is the only proof an event landed. `/verify/` on the published site is the
console for that. Row counts arrive in bursts, and one table has been seen to
take twenty minutes, so a count that has not moved after two minutes proves
nothing yet.

**`?debug=1`** on any page shows every event it sent, with the payload and the
destination table.

## Running it

```bash
python3 -m http.server 8101              # the repository root, for quick work
python3 tools/build-dist.py              # the publishable site, with its guard
(cd dist && python3 -m http.server 8102) # what actually ships
```

Checks, all of which take `--base`:

```bash
python3 tools/test-rebrand.py                                  # 40 cases, no browser
python3 tools/test-build-dist.py                               #  9 cases, no browser
node tools/verify.mjs         --base http://localhost:8102     # 44 assertions
node tools/verify-lincoln.mjs --base http://localhost:8102     # 56 assertions
node tools/mobile-check.mjs   --base http://localhost:8102     # 32, two phones
node tools/asset-sweep.mjs    --base http://localhost:8102     # every request
```

Regenerating pages needs no network: `python3 tools/build-pages.py` and
`python3 tools/build-lincoln.py` read `reference/`, which is tracked for that
reason. The only difference a rebuild makes is the cache-busting stamp.

## Where the detail lives

| File | What it covers |
|---|---|
| `HANDOVER.md` | what is left to do, every placeholder, all 37 Supabase secrets |
| `supabase/functions/DEPLOY.md` | the JWT setting that is not in this repository and breaks everything if missed |
| `panel/README.md` | everything with a counterpart someone clicks in the Dengage panel |
| `panel/WALKTHROUGH.md` | 53 steps, a Google ad click to a car sold |
| `panel/VERIFY.md` | how to prove each capability, including push on a phone |
| `panel/CONTENT.md` | the copy for every message |
| `reference/README.md` | the capture material and which build reads what |
