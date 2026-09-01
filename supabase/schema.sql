-- Nissan KSA demo: synthetic PRE-PURCHASE dataset, namespaced ni_.
-- Applied to the shared presales Postgres on 28 August 2026 as migration
-- nissan_ksa_demo_pre_purchase_tables. Every value the seed writes is
-- invented: DEMO- VINs, 555-block mobiles, DPS- contact keys. Created
-- additively; nothing here touches dps_, rh_ or hy_ objects. Read through
-- the Dengage remote-source connection only: RLS is enabled with no
-- policies, exactly like the hy_ tables.

create table if not exists public.ni_branch (
  branch_id   text primary key,
  name        text not null,
  city        text not null,
  branch_type text not null default 'Showroom',
  lat         numeric(9,6),
  lng         numeric(9,6)
);
comment on table public.ni_branch is
  'Sample branch list for the Nissan KSA demo. Coordinates are city-level approximations, not real branch addresses.';

create table if not exists public.ni_showroom_lead (
  lead_id          bigint generated always as identity primary key,
  contact_key      text not null,
  full_name        text not null,
  mobile           text not null,
  city             text not null,
  model            text not null,
  stage            text not null,
  purchase_horizon text,
  branch_id        text references public.ni_branch(branch_id),
  source           text not null default 'showroom',
  stage_date       date not null,
  note             text
);
comment on table public.ni_showroom_lead is
  'Synthetic offline pre-purchase leads for the Nissan KSA demo: walk-ins, offline test drives, no-shows, quotes, call outcomes, WhatsApp intents. Every value is invented; contact keys are DPS- demo keys.';

create table if not exists public.ni_existing_customer (
  customer_id     bigint generated always as identity primary key,
  contact_key     text not null,
  full_name       text not null,
  mobile          text not null,
  city            text not null,
  current_model   text not null,
  model_year      int not null,
  vin             text not null,
  preferred_branch text references public.ni_branch(branch_id)
);
comment on table public.ni_existing_customer is
  'Synthetic sample standing in for the existing customer database in the Nissan KSA demo, used for the upgrade and repurchase audience. Every value is invented: DEMO- VINs, 555-block mobiles.';

create table if not exists public.ni_dealer_stock (
  branch_id   text not null references public.ni_branch(branch_id),
  model       text not null,
  model_year  int not null,
  stock_count int not null,
  primary key (branch_id, model, model_year)
);
comment on table public.ni_dealer_stock is
  'Synthetic per-branch availability for the Nissan KSA demo stock-aware campaign story. Counts are invented sample data.';

alter table public.ni_branch enable row level security;
alter table public.ni_showroom_lead enable row level security;
alter table public.ni_existing_customer enable row level security;
alter table public.ni_dealer_stock enable row level security;

-- ---------------------------------------------------------------------------
-- The storefront message centre.
--
-- Dengage's App Inbox is filled by a campaign and by nothing else: no endpoint
-- writes to it, transactional sends are documented as unavailable for that
-- channel, and a campaign runs on a schedule. So the one channel a visitor can
-- see inside the page was the only one that could not answer the moment they
-- acted. These two tables are the demo's own inbox, written by
-- supabase/functions/nissan-booking-confirm and read by the bell drawer, which
-- shows them merged with whatever Dengage's own inbox holds.
--
-- Nothing here is staged: a row exists because a moment genuinely happened,
-- its copy is filled with the same values the email and the push carried, and
-- channels records which Dengage channels carried that same moment.

create table if not exists public.ni_inbox_template (
  brand      text not null,
  moment     text not null,
  title      text not null,
  body       text not null,
  updated_at timestamptz not null default now(),
  primary key (brand, moment)
);
comment on table public.ni_inbox_template is
  'Copy for the storefront message centre, one row per brand and moment. Placeholders in braces, such as {model}, are filled with the same send parameters the email and push use. Editable with one update statement and no deploy.';

create table if not exists public.ni_inbox (
  id           bigint generated always as identity primary key,
  contact_key  text,
  device_token text,
  brand        text not null,
  moment       text not null,
  title        text not null,
  body         text not null,
  media_url    text,
  target_url   text,
  channels     text,
  /* What Dengage answered for each channel of this moment. channels says a
     push was accepted; it cannot say whether the contact was addressed or the
     token fallback ran, and when a notification does not appear that is the
     first thing worth knowing. Server side only: the drawer never reads it. */
  detail       text,
  sent_at      timestamptz not null default now()
);
comment on table public.ni_inbox is
  'Messages the demo delivered to its own storefront drawer, one row per moment raised. Addressed by contact key, by device token, or by both, so an anonymous visitor keeps their messages after a form gives them a name. channels names which Dengage channels carried the same moment, or reads "inbox only" when neither did.';

-- Read paths the drawer uses: newest first for a contact, and for a device.
create index if not exists ni_inbox_contact_idx on public.ni_inbox (contact_key, sent_at desc);
create index if not exists ni_inbox_device_idx  on public.ni_inbox (device_token, sent_at desc);

alter table public.ni_inbox_template enable row level security;
alter table public.ni_inbox enable row level security;
