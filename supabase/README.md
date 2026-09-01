# The synthetic pre-purchase dataset

Four `ni_` tables in the shared presales Postgres (the same instance the
Dengage remote-source connection already reads), created and seeded on
28 August 2026 for the Nissan KSA demo. Everything is invented and announces
itself as invented: DEMO VINs, 555-block mobiles, DPS- contact keys, and the
seed is deterministic (`setseed`) so the segment sizes quoted in
`panel/README.md` are exact.

| Table | Rows | Purpose |
|---|---|---|
| `ni_branch` | 8 | the branch list the Find a Showroom page and the stock story use |
| `ni_showroom_lead` | 219 | offline pre-purchase moments: walk-ins, offline test drives, no-shows, quotes, call outcomes, WhatsApp intents |
| `ni_existing_customer` | 261 | the sample standing in for the 500K customer base, for the upgrade audience |
| `ni_dealer_stock` | 72 | per-branch availability; X-TRAIL is in stock at 6 of 8 branches by design |
| `ni_inbox_template` | 20 | the copy the storefront message centre sends, ten moments per brand |
| `ni_inbox` | grows | the messages it has delivered, one row per moment raised, with `detail` carrying what Dengage answered per channel |

`schema.sql` is the DDL as applied (RLS enabled, no policies: the tables are
read through the Dengage remote-source connection and the service role,
never a browser). `seed.sql` reproduces the exact seeded state, including
the eight engineered DPS-1 to DPS-8 personas that match the dealer cockpit
line for line. `inbox-copy.sql` holds the drawer's own words, so a line can be
changed on the day with one statement and no deploy; re-running it restores
the documented copy and leaves every delivered message alone.

The last two tables are the storefront message centre. Dengage's App Inbox is
filled by a campaign and by nothing else, so the one channel a visitor can see
inside the page could not answer at the second they acted. The demo therefore
carries its own, written by `functions/nissan-booking-confirm` at the instant
of the send and merged into the same drawer as Dengage's. `ni_inbox` grows by
one row per moment raised and is never trimmed here.

Nothing here touches the `dps_`, `rh_` or `hy_` objects that share the
database, and nothing in this repository deletes anything in Dengage.
