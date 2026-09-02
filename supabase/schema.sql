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

-- ---------------------------------------------------------------------------
-- The read-only role Dengage connects as, and the views it reads
-- ---------------------------------------------------------------------------
-- Dengage's Remote Data Source connects to this database directly, as a
-- Postgres client. It needs a login of its own: the service key belongs to the
-- edge functions and grants far more than a segment query should ever hold.
--
-- Two things had to be true before a remote source could return a single row.
-- Row level security is enabled on the ni_ tables and no policy existed, which
-- is a silent refusal rather than an error: the role connects, authenticates,
-- and every select answers zero rows. And a role with no grants sees nothing to
-- select from in the first place. Both are fixed below, in that order.
--
-- The password is not in this repository and never will be: this file is
-- public. It is set once, by hand, and given to the panel. To rotate it:
--   alter role dengage_reader with password '<new password>';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dengage_reader') then
    -- Password set separately, out of band. A role with no password cannot log in.
    create role dengage_reader with login nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

comment on role dengage_reader is
  'Read only login for the Dengage Remote Data Source. Select on the ni_ demo tables and the v_ni_ segment views, nothing else: no insert, no update, no delete, no access to ni_inbox or ni_web_lead beyond what a segment needs.';

grant usage on schema public to dengage_reader;
grant select on public.ni_showroom_lead, public.ni_existing_customer,
                 public.ni_branch, public.ni_dealer_stock, public.ni_web_lead
  to dengage_reader;

-- RLS stays on. These policies open reading, and only reading, to that one role.
create policy dengage_remote_read on public.ni_showroom_lead
  for select to dengage_reader using (true);
create policy dengage_remote_read on public.ni_existing_customer
  for select to dengage_reader using (true);
create policy dengage_remote_read on public.ni_branch
  for select to dengage_reader using (true);
create policy dengage_remote_read on public.ni_dealer_stock
  for select to dengage_reader using (true);
create policy dengage_remote_read on public.ni_web_lead
  for select to dengage_reader using (true);

-- The segment views. security_invoker = true so each one is still filtered by
-- the policies above rather than by the owner's rights: a view is otherwise a
-- way around RLS, and a segment source is the last place that should be true.

-- One row per person the demo knows anything about, from either side of the
-- glass. This is the composable CDP claim made queryable: web_leads counts what
-- the website saw, showroom_events counts what the dealer logged, and
-- known_both_sides is true only where the same contact key carries both.
create or replace view public.v_ni_contact_360 with (security_invoker = true) as
  with web as (
    select contact_key, count(*) as web_leads, max(created_at) as last_web_at,
           bool_or(coalesce(marketing_consent, false)) as marketing_consent
    from public.ni_web_lead where contact_key is not null group by contact_key
  ), web_last as (
    select distinct on (contact_key) contact_key, model as last_web_model,
           city as web_city, purchase_horizon as web_horizon, utm_source as first_source,
           case when page_url like '%/lincoln/%' then 'lincoln' else 'nissan' end as site
    from public.ni_web_lead where contact_key is not null
    order by contact_key, created_at desc
  ), shw as (
    select contact_key, count(*) as showroom_events, max(stage_date) as last_showroom_date
    from public.ni_showroom_lead where contact_key is not null group by contact_key
  ), shw_last as (
    select distinct on (contact_key) contact_key, stage as last_stage,
           model as last_showroom_model, branch_id,
           purchase_horizon as showroom_horizon, city as showroom_city
    from public.ni_showroom_lead where contact_key is not null
    order by contact_key, stage_date desc, lead_id desc
  )
  select coalesce(w.contact_key, s.contact_key, o.contact_key) as contact_key,
         coalesce(wl.web_city, sl.showroom_city, o.city) as city,
         coalesce(w.web_leads, 0) as web_leads,
         wl.last_web_model, w.last_web_at, wl.first_source,
         coalesce(w.marketing_consent, false) as marketing_consent,
         coalesce(s.showroom_events, 0) as showroom_events,
         sl.last_stage, sl.last_showroom_model, sl.branch_id, s.last_showroom_date,
         coalesce(wl.web_horizon, sl.showroom_horizon) as purchase_horizon,
         (o.contact_key is not null) as is_owner,
         o.current_model as owned_model, o.model_year as owned_year,
         (coalesce(w.web_leads, 0) > 0 and coalesce(s.showroom_events, 0) > 0) as known_both_sides,
         -- Which storefront the last web lead came from. Both demos share one
         -- contact space, so a segment has to be able to say which it means.
         wl.site as last_web_site
  from web w
  full join shw s using (contact_key)
  full join public.ni_existing_customer o using (contact_key)
  left join web_last wl on wl.contact_key = coalesce(w.contact_key, s.contact_key, o.contact_key)
  left join shw_last sl on sl.contact_key = coalesce(w.contact_key, s.contact_key, o.contact_key);

-- Buying within a month, from whichever side of the business said so.
create or replace view public.v_ni_hot_leads with (security_invoker = true) as
  select contact_key, city, purchase_horizon,
         coalesce(last_web_model, last_showroom_model) as model,
         branch_id, last_stage, known_both_sides
  from public.v_ni_contact_360
  where purchase_horizon ilike '%1 month%' or purchase_horizon ilike '%within 1%';

-- Booked a test drive and did not arrive, and has not been driven or sold to
-- since. The not exists is what keeps a re-invite off someone who came back.
create or replace view public.v_ni_no_show with (security_invoker = true) as
  select contact_key, full_name, mobile, city, model, branch_id, stage_date
  from public.ni_showroom_lead l
  where stage = 'no_show'
    and not exists (
      select 1 from public.ni_showroom_lead later
      where later.contact_key = l.contact_key
        and later.stage in ('test_drive_done', 'sold')
        and later.stage_date >= l.stage_date);

-- Quotes that never became a sale. days_since_quote is the age the follow-up
-- journey waits on, so the segment can pick its own quiet period.
create or replace view public.v_ni_quote_open with (security_invoker = true) as
  select contact_key, full_name, mobile, city, model, branch_id, stage_date,
         (current_date - stage_date) as days_since_quote
  from public.ni_showroom_lead l
  where stage = 'quote_issued'
    and not exists (
      select 1 from public.ni_showroom_lead later
      where later.contact_key = l.contact_key and later.stage = 'sold');

-- Owners three years in or more: the pre-purchase moment for their next car.
create or replace view public.v_ni_upgrade_candidates with (security_invoker = true) as
  select contact_key, full_name, mobile, city, current_model, model_year,
         preferred_branch,
         (extract(year from current_date)::int - model_year) as years_owned
  from public.ni_existing_customer o
  where (extract(year from current_date)::int - model_year) >= 3;

-- Where a model is not on the ground. A campaign that reads this sends people
-- to a branch that can actually hand them the keys.
create or replace view public.v_ni_stock_gap with (security_invoker = true) as
  select s.branch_id, b.name as branch_name, b.city, s.model, s.model_year, s.stock_count
  from public.ni_dealer_stock s
  join public.ni_branch b on b.branch_id = s.branch_id
  where s.stock_count = 0;

-- Every lead with its showroom attached, for the dealer scoped segments a
-- sub-account would own.
create or replace view public.v_ni_dealer_leads with (security_invoker = true) as
  select l.branch_id, b.name as branch_name, b.city, l.contact_key, l.full_name,
         l.mobile, l.model, l.stage, l.purchase_horizon, l.stage_date
  from public.ni_showroom_lead l
  join public.ni_branch b on b.branch_id = l.branch_id;

grant select on public.v_ni_contact_360, public.v_ni_hot_leads, public.v_ni_no_show,
                 public.v_ni_quote_open, public.v_ni_upgrade_candidates,
                 public.v_ni_stock_gap, public.v_ni_dealer_leads
  to dengage_reader;

-- ---------------------------------------------------------------------------
-- The one table a Dengage remote source would not take
-- ---------------------------------------------------------------------------
-- Four of the five ni_ tables connected first time and ni_dealer_stock did not.
-- It is also the only one whose primary key is three columns rather than one:
-- branch_id, model and model_year together. A remote source is configured by
-- choosing the column that identifies a row, so a composite key leaves nothing
-- to choose.
--
-- Additive, so no row was touched and the natural key keeps its constraint.
-- stock_id exists for the remote source to point at, and for nothing else.
alter table public.ni_dealer_stock
  add column if not exists stock_id bigint generated always as identity;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ni_dealer_stock'::regclass and conname = 'ni_dealer_stock_stock_id_key'
  ) then
    alter table public.ni_dealer_stock add constraint ni_dealer_stock_stock_id_key unique (stock_id);
  end if;
end $$;

comment on column public.ni_dealer_stock.stock_id is
  'Surrogate single column key so a Dengage remote source has one column to identify a row by. The real key is still branch_id, model and model_year together.';
