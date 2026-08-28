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
