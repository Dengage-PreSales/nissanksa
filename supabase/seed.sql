-- Seed the Nissan KSA demo dataset, exactly as run on 28 August 2026.
-- Deterministic: setseed makes every run produce the same rows. random()
-- must sit in a CTE select list to evaluate per row; the seeded CTE join is
-- what makes setseed apply before the first random() call.
-- The deletes below empty only the four ni_ demo tables this file owns, so
-- re-running reproduces the exact documented state. They touch nothing else.
begin;

delete from public.ni_dealer_stock;
delete from public.ni_showroom_lead;
delete from public.ni_existing_customer;
delete from public.ni_branch;

insert into public.ni_branch (branch_id, name, city, branch_type, lat, lng) values
  ('riyadh-olaya',   'Olaya Showroom',           'Riyadh', 'Showroom', 24.6949, 46.6853),
  ('riyadh-exit5',   'Exit 5 Showroom',          'Riyadh', 'Showroom', 24.8180, 46.6410),
  ('jeddah-madinah', 'Madinah Road Showroom',    'Jeddah', 'Showroom', 21.5810, 39.1730),
  ('jeddah-corniche','Corniche Showroom',        'Jeddah', 'Showroom', 21.5430, 39.1520),
  ('dammam-kfr',     'King Fahd Road Showroom',  'Dammam', 'Showroom', 26.4207, 50.0888),
  ('khobar',         'Khobar Showroom',          'Khobar', 'Showroom', 26.2172, 50.1971),
  ('makkah',         'Makkah Showroom',          'Makkah', 'Showroom', 21.3891, 39.8579),
  ('madinah',        'Madinah Showroom',         'Madinah','Showroom', 24.5247, 39.5692);

-- The eight presenter personas, engineered to match the dealer cockpit and
-- the run of show. DPS-1 is the demo's main character.
insert into public.ni_showroom_lead
  (contact_key, full_name, mobile, city, model, stage, purchase_horizon, branch_id, source, stage_date, note) values
  ('DPS-1','Ahmed Al-Rashid','+966555100001','Riyadh','x-trail','walk_in','From 1 to 3 Months','riyadh-olaya','showroom', current_date - 6,'Walked in with family, compared 5 and 7 seats'),
  ('DPS-1','Ahmed Al-Rashid','+966555100001','Riyadh','x-trail','quote_issued','From 1 to 3 Months','riyadh-olaya','showroom', current_date - 4,'SV grade quote handed over at the desk'),
  ('DPS-2','Sara Al-Qahtani','+966555100002','Jeddah','patrol','whatsapp_intent',null,null,'value-first-whatsapp', current_date - 2,'Asked the chatbot about financing'),
  ('DPS-3','Mohammed Al-Harbi','+966555100003','Riyadh','x-trail','test_drive_booked','More Than 3 Months','riyadh-exit5','call-center', current_date - 9,'Booked over the phone'),
  ('DPS-3','Mohammed Al-Harbi','+966555100003','Riyadh','x-trail','no_show',null,'riyadh-exit5','showroom', current_date - 7,'Did not arrive for the Thursday slot'),
  ('DPS-5','Khalid Al-Ghamdi','+966555100005','Riyadh','patrol-pro4x','walk_in','Within 1 Month','riyadh-olaya','showroom', current_date - 1,'Ready buyer, trade-in mentioned'),
  ('DPS-6','Fatima Al-Zahrani','+966555100006','Makkah','kicks','call_outcome','From 1 to 3 Months',null,'call-center', current_date - 3,'Asked to be called after payday'),
  ('DPS-7','Omar Al-Shehri','+966555100007','Khobar','x-terra','test_drive_done',null,'khobar','showroom', current_date - 1,'Drive completed, liked the third row'),
  ('DPS-8','Layla Al-Mutairi','+966555100008','Jeddah','tekton','register_interest',null,null,'website', current_date - 5,'Waiting list signup');

-- DPS-4 lives in the existing-customer sample: the upgrade story.
insert into public.ni_existing_customer
  (contact_key, full_name, mobile, city, current_model, model_year, vin, preferred_branch) values
  ('DPS-4','Noura Al-Otaibi','+966555100004','Dammam','altima',2019,'DEMO4NKSA00000004','dammam-kfr');

-- Bulk synthetic rows, deterministic.
with seeded as (select setseed(0.42)),
names as (
  select first_names[1 + (i % 12)] || ' ' || last_names[1 + ((i / 12) % 12)] as full_name, i
  from (
    select generate_series(1, 210) as i,
      array['Abdullah','Salma','Faisal','Reem','Yousef','Huda','Turki','Amal','Nasser','Dana','Badr','Lama'] as first_names,
      array['Al-Saud','Al-Fahad','Al-Anazi','Al-Dossari','Al-Malki','Al-Juhani','Al-Subaie','Al-Amri','Al-Qarni','Al-Yami','Al-Bishi','Al-Rashidi'] as last_names
  ) g
),
rows as (
  select
    'DPS-9' || lpad(i::text, 5, '0') as contact_key,
    full_name,
    '+96655510' || lpad((1000 + i)::text, 4, '0') as mobile,
    (array['Riyadh','Riyadh','Riyadh','Jeddah','Jeddah','Dammam','Khobar','Makkah','Madinah'])[1 + floor(random() * 9)::int] as city,
    (array['x-trail','x-trail','magnite','kicks','patrol','patrol-pro4x','pathfinder','altima','x-terra','z'])[1 + floor(random() * 10)::int] as model,
    (array['walk_in','walk_in','walk_in','test_drive_booked','test_drive_booked','test_drive_done','no_show','quote_issued','quote_issued','call_outcome','whatsapp_intent'])[1 + floor(random() * 11)::int] as stage,
    (array['Within 1 Month','From 1 to 3 Months','From 1 to 3 Months','More Than 3 Months',null])[1 + floor(random() * 5)::int] as purchase_horizon,
    (array['riyadh-olaya','riyadh-exit5','jeddah-madinah','jeddah-corniche','dammam-kfr','khobar','makkah','madinah'])[1 + floor(random() * 8)::int] as branch_id,
    current_date - (floor(random() * 60))::int as stage_date,
    i
  from names, seeded
)
insert into public.ni_showroom_lead
  (contact_key, full_name, mobile, city, model, stage, purchase_horizon, branch_id, source, stage_date)
select contact_key, full_name, mobile, city, model, stage, purchase_horizon, branch_id,
  case when stage = 'whatsapp_intent' then 'value-first-whatsapp'
       when stage = 'call_outcome' then 'call-center'
       else 'showroom' end,
  stage_date
from rows;

with seeded as (select setseed(0.7)),
names as (
  select first_names[1 + (i % 12)] || ' ' || last_names[1 + ((i / 12) % 12)] as full_name, i
  from (
    select generate_series(1, 260) as i,
      array['Majed','Noor','Sami','Aisha','Hassan','Muna','Rakan','Ghada','Ziyad','Hind','Saad','Jana'] as first_names,
      array['Al-Harthi','Al-Zahid','Al-Nasser','Al-Suwailem','Al-Omran','Al-Khalidi','Al-Mansour','Al-Tamimi','Al-Sharif','Al-Ruwaili','Al-Hazmi','Al-Salem'] as last_names
  ) g
)
insert into public.ni_existing_customer
  (contact_key, full_name, mobile, city, current_model, model_year, vin, preferred_branch)
select
  'DPS-8' || lpad(i::text, 5, '0'),
  full_name,
  '+96655520' || lpad((1000 + i)::text, 4, '0'),
  (array['Riyadh','Riyadh','Jeddah','Jeddah','Dammam','Khobar','Makkah','Madinah'])[1 + floor(random() * 8)::int],
  (array['altima','altima','patrol','x-trail','pathfinder','maxima','sunny','sunny'])[1 + floor(random() * 8)::int],
  2016 + floor(random() * 9)::int,
  'DEMO' || lpad(i::text, 13, '0'),
  (array['riyadh-olaya','riyadh-exit5','jeddah-madinah','jeddah-corniche','dammam-kfr','khobar','makkah','madinah'])[1 + floor(random() * 8)::int]
from names, seeded;

with seeded as (select setseed(0.13))
insert into public.ni_dealer_stock (branch_id, model, model_year, stock_count)
select b.branch_id, m.model, 2026, floor(random() * 7)::int
from public.ni_branch b,
     unnest(array['magnite','kicks','x-trail','x-terra','pathfinder','patrol','patrol-pro4x','altima','z']) as m(model),
     seeded;

-- The stock-aware campaign story needs branches without the car: X-TRAIL is
-- deliberately out of stock at two of the eight.
update public.ni_dealer_stock set stock_count = 0
where model = 'x-trail' and branch_id in ('makkah', 'madinah');

commit;
