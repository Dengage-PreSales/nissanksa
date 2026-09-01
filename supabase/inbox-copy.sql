-- The copy the storefront message centre sends, ten moments per brand.
--
-- This is the record of what is live, so the drawer's words are recoverable
-- from git rather than only from the database. Re-running it restores the
-- documented state without touching any message already delivered: it upserts
-- the template rows and leaves ni_inbox alone.
--
-- Placeholders in braces are filled with the same parameters the email and the
-- push carry for that moment, so {model} reads Navigator for one visitor and
-- X-Trail for the next. A placeholder with no value resolves to nothing and
-- the surrounding spaces are collapsed, which is why every line still reads as
-- a sentence when the visitor has not chosen a car yet.
--
-- To change one line on the day, edit it here and run the same statement:
--
--   update public.ni_inbox_template
--      set title = 'Your {model} drive is booked'
--    where brand = 'nissan' and moment = 'booking';

begin;

insert into public.ni_inbox_template (brand, moment, title, body) values
  ('lincoln', 'booking',           'Your {model} drive is booked',   'We have your request. The showroom will call you to agree a time.'),
  ('lincoln', 'abandoned_booking', 'One step left on your {model}',  'Your booking is nearly done. Pick it up where you left off.'),
  ('lincoln', 'quote',             'Your {model} quote is coming',   'A specialist is putting your figures together right now.'),
  ('lincoln', 'brochure',          'The {model} details',            'Everything you were reading, kept in one place for you.'),
  ('lincoln', 'newsletter',        'You are on the list',            'New arrivals and offers from Mohamed Yousuf Naghi Motors, first.'),
  ('lincoln', 'survey',            'Thank you',                      'Your answer is with the showroom team, on your profile.'),
  ('lincoln', 'showroom_visit',    'Good to meet you',               'Thank you for visiting us today. We are here whenever you want a drive.'),
  ('lincoln', 'test_drive_done',   'How was the {model}?',           'Tell us what you thought. There is no pressure attached.'),
  ('lincoln', 'inbox_message',     'A message is waiting for you',   'Open the {model} page to read it in your inbox.'),
  ('lincoln', 'no_show',           'Another time?',                  'The {model} is still here whenever you are.'),
  -- Nissan reads the same moments. Only the newsletter differs, because the
  -- Lincoln line welcomes you to a named dealer and Nissan has its own.
  ('nissan',  'booking',           'Your {model} drive is booked',   'We have your request. The showroom will call you to agree a time.'),
  ('nissan',  'abandoned_booking', 'One step left on your {model}',  'Your booking is nearly done. Pick it up where you left off.'),
  ('nissan',  'quote',             'Your {model} quote is coming',   'A specialist is putting your figures together right now.'),
  ('nissan',  'brochure',          'The {model} details',            'Everything you were reading, kept in one place for you.'),
  ('nissan',  'newsletter',        'You are on the list',            'New arrivals and offers reach you first.'),
  ('nissan',  'survey',            'Thank you',                      'Your answer is with the showroom team, on your profile.'),
  ('nissan',  'showroom_visit',    'Good to meet you',               'Thank you for visiting us today. We are here whenever you want a drive.'),
  ('nissan',  'test_drive_done',   'How was the {model}?',           'Tell us what you thought. There is no pressure attached.'),
  ('nissan',  'inbox_message',     'A message is waiting for you',   'Open the {model} page to read it in your inbox.'),
  ('nissan',  'no_show',           'Another time?',                  'The {model} is still here whenever you are.')
on conflict (brand, moment) do update
   set title = excluded.title,
       body = excluded.body,
       updated_at = now();

commit;
