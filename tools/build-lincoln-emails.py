#!/usr/bin/env python3
"""Emits the ready to paste message content for every moment the demo sends.

Everything under panel/lincoln/ is content for the Dengage panel: one email
body per moment, one push entry per moment, and the index that says which
content id belongs where. They are generated rather than hand written so the
whole set stays consistent: one frame, one palette, one footer, and the same
personalization tags in the same order.

The tags are the panel's own template language:

    {%= $Current.model %}     a value passed by the API call that triggers it
    {%= $Contact.name %}      a column on the contact record
    {%= a || b %}             the fallback used when a value was not sent
    {% if (a) { %} ... {% } %}   print this only when a value was sent

A transactional send can only see $Current, which is why every value these
messages use travels in the API call. supabase/functions/nissan-booking-confirm
sends them, and that function guarantees four of them are never empty: model,
model_url, model_image and booking_url. Those four are safe in a push title,
in a Target URL and in the Media field, where the panel offers no conditions
and an empty value would leave a visible hole. Everything else is optional and
is only ever printed inside a condition.

Run from the repository root:  python3 tools/build-lincoln-emails.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'panel' / 'lincoln'

SLATE, BRONZE, INK, MUTED, LINE, PAGE = '#324047', '#b45f1a', '#1c1f21', '#5b6770', '#ecebe8', '#f5f4f2'

ORIGIN = 'https://dengage-presales.github.io/nissanksa/lincoln/'
# The three destinations a message can send someone to. The first two are tags
# the function always fills, so they carry no fallback: a fallback on a value
# that is always sent is syntax nobody has tested standing in a field where a
# failure is silent. The third is a fixed page and is written as one.
RANGE_URL = '{%= $Current.model_url %}'
FORM_URL = '{%= $Current.booking_url %}'
CONTACT_URL = ORIGIN + 'contact-us/'

DENGAGE_MARK = (
    '<span style="font:700 15px/1 Arial,sans-serif;letter-spacing:.14em;color:#ffffff">DENGAGE</span>'
    '<br><span style="font:400 9px/1.6 Arial,sans-serif;letter-spacing:.3em;color:#9aa3a8">AUTO DEMO</span>'
)

FOOTER = f"""      <tr><td style="padding:22px 28px 26px;background:{SLATE}">
        {DENGAGE_MARK}
        <p style="margin:14px 0 0;font:400 11.5px/1.7 Arial,sans-serif;color:#9aa3a8">
          A demonstration message from a Dengage sales demo. Vehicle names and imagery come from the
          public Lincoln Saudi Arabia website of Mohamed Yousuf Naghi Motors. It is not sent for
          Lincoln or the dealer, and no booking was made with them.
        </p>
        <p style="margin:10px 0 0;font:400 11.5px/1.7 Arial,sans-serif;color:#9aa3a8">
          <a href="{{{{unsubscribe-link}}}}" style="color:#9aa3a8">Unsubscribe</a>
        </p>
      </td></tr>"""


def rows(pairs):
    """A detail table that prints a line only when its value was sent."""
    out = []
    for label, tag in pairs:
        out.append(
            f'        {{% if ({tag}) {{ %}}\n'
            f'        <tr><td style="padding:9px 0;border-bottom:1px solid {LINE};'
            f'font:400 12.5px/1.4 Arial,sans-serif;color:#8b9296">{label}</td>\n'
            f'            <td style="padding:9px 0;border-bottom:1px solid {LINE};text-align:right;'
            f'font:400 14px/1.4 Arial,sans-serif;color:{INK}">{{%= {tag} %}}</td></tr>\n'
            f'        {{% }} %}}'
        )
    return '\n'.join(out)


def email(subject, preheader, kicker, headline, lead, detail_pairs,
          cta_label, cta_tag, closing, second=None, **_ignored):
    """One message in the shared frame: image, kicker, headline, lead, details,
       one action, one closing line, and the demonstration footer."""
    detail = rows(detail_pairs)
    second_block = f"""      <tr><td style="padding:2px 28px 0">
        <p style="margin:0;font:400 13.5px/1.7 Arial,sans-serif;color:{MUTED}">{second}</p>
      </td></tr>""" if second else ''
    return f"""<!-- Lincoln demo message. Paste the block below into
     Content > Email > new content > HTML source, and set:

       Subject    {subject}
       Preheader  {preheader}

     Every $Current value below is sent by the message function. model,
     model_url, model_image and booking_url are always sent, so they need no
     fallback; the rest print only when the visitor gave them. Nothing here
     reads the contact record, because a transactional send cannot see it. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:0;padding:0;background:{PAGE}">
  <tr><td align="center" style="padding:26px 12px">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0"
           style="width:520px;max-width:520px;background:#ffffff;border-top:3px solid {BRONZE}">
      <tr><td style="padding:0">
        <img src="{{%= $Current.model_image %}}" width="520" alt="{{%= $Current.model %}}"
             style="display:block;width:100%;max-width:520px;height:auto;border:0">
      </td></tr>
      <tr><td style="padding:30px 28px 8px">
        <p style="margin:0 0 10px;font:400 11px/1 Arial,sans-serif;letter-spacing:.18em;
                  text-transform:uppercase;color:{BRONZE}">{kicker}</p>
        <h1 style="margin:0 0 12px;font:600 23px/1.25 Georgia,'Times New Roman',serif;color:{SLATE}">
          {headline}
        </h1>
        <p style="margin:0 0 20px;font:400 14.5px/1.65 Arial,sans-serif;color:{MUTED}">
          {lead}
        </p>
      </td></tr>
      <tr><td style="padding:0 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{detail}
        </table>
      </td></tr>
      <tr><td style="padding:24px 28px 6px">
        <a href="{cta_tag}"
           style="display:inline-block;padding:12px 26px;background:{SLATE};color:#ffffff;
                  font:400 14px/1 Arial,sans-serif;letter-spacing:.04em;text-decoration:none">
          {cta_label}
        </a>
      </td></tr>
{second_block}
      <tr><td style="padding:18px 28px 28px">
        <p style="margin:0;font:400 13px/1.65 Arial,sans-serif;color:{MUTED}">{closing}</p>
      </td></tr>
{FOOTER}
    </table>
  </td></tr>
</table>
"""


# The detail lines each message carries. Every tag here is optional, so a row
# is printed only when the visitor actually gave that value.
BOOKING_ROWS = [
    ('Model', '$Current.model'),
    ('Seats', '$Current.model_seats'),
    ('Name', '$Current.full_name'),
    ('Mobile', '$Current.gsm'),
    ('City', '$Current.city'),
    ('Showroom', '$Current.branch'),
    ('Buying', '$Current.purchase_horizon'),
    ('Reference', '$Current.booking_ref'),
]
SHORT_ROWS = [
    ('Model', '$Current.model'),
    ('Seats', '$Current.model_seats'),
    ('City', '$Current.city'),
    ('Showroom', '$Current.branch'),
]
VISIT_ROWS = [
    ('Showroom', '$Current.branch'),
    ('City', '$Current.city'),
    ('Model', '$Current.model'),
    ('Seats', '$Current.model_seats'),
]

# One entry per moment. `slug` is the file and the moment name the function
# uses; `env` is the pair of variables that carry the content ids once they
# exist; `trigger` is the thing the visitor does that sends it.
MOMENTS = [
    dict(
        slug='booking-confirmation',
        moment='booking',
        title='Test drive booked',
        trigger='when the test drive form is submitted on the storefront',
        env=('DENGAGE_TX_EMAIL_CONTENT_ID', 'DENGAGE_TX_PUSH_CONTENT_ID'),
        subject="Your {%= $Current.model %} test drive is booked",
        preheader='The showroom has your request and will call to agree a time.',
        kicker='Test drive booked',
        headline="Your {%= $Current.model %} is reserved for a drive",
        lead="{% if ($Current.first_name) { %}Thank you {%= $Current.first_name %}. The team{% } "
             "else { %}Thank you. The team{% } %} at Mohamed Yousuf Naghi Motors has your request "
             "and will call to agree a time that suits you.",
        detail_pairs=BOOKING_ROWS,
        cta_label='See the model again',
        cta_tag=RANGE_URL,
        closing='Anything to change before the drive? Reply to this message and the showroom team will pick it up.',
        push_title="Your {%= $Current.model %} drive is booked",
        push_body='We have your request. The showroom will call you to agree a time.',
        push_url=FORM_URL,
    ),
    dict(
        slug='abandoned-booking',
        moment='abandoned_booking',
        title='Booking started and left',
        trigger='when the visitor types into the booking form, then leaves without submitting',
        env=('DENGAGE_TX_EMAIL_ABANDONED', 'DENGAGE_TX_PUSH_ABANDONED'),
        subject="One step left on your {%= $Current.model %}",
        preheader='Your booking is saved. Pick it up where you left off.',
        kicker='Still interested?',
        headline="Your {%= $Current.model %} booking is one step from done",
        lead="You started arranging a drive and did not finish. Nothing is lost. Pick it up where "
             "you left off and the showroom takes it from there.",
        detail_pairs=SHORT_ROWS,
        cta_label='Finish my booking',
        cta_tag=FORM_URL,
        closing='If the timing is wrong, ignore this message and we will leave it there.',
        push_title="One step left on your {%= $Current.model %}",
        push_body='Your booking is nearly done. Pick it up where you left off.',
        push_url=FORM_URL,
    ),
    dict(
        slug='quote-acknowledgement',
        moment='quote',
        title='Quote requested',
        trigger='when the online quote form is submitted',
        env=('DENGAGE_TX_EMAIL_QUOTE', 'DENGAGE_TX_PUSH_QUOTE'),
        subject="Your {%= $Current.model %} quote is being prepared",
        preheader='A specialist is putting your figures together now.',
        kicker='Quote requested',
        headline="Your {%= $Current.model %} quote is on its way",
        lead="{% if ($Current.first_name) { %}Thank you {%= $Current.first_name %}. A specialist{% } "
             "else { %}Thank you. A specialist{% } %} at Mohamed Yousuf Naghi Motors is putting your "
             "figures together and will be in touch with them.",
        detail_pairs=SHORT_ROWS,
        cta_label='Explore the model',
        cta_tag=RANGE_URL,
        closing='A test drive can be arranged for the same visit if you would like one.',
        push_title="Your {%= $Current.model %} quote is coming",
        push_body='A specialist is putting your figures together right now.',
        push_url=RANGE_URL,
    ),
    dict(
        slug='brochure-delivery',
        moment='brochure',
        title='Specification downloaded',
        trigger='when a specification sheet is downloaded from a model page',
        env=('DENGAGE_TX_EMAIL_BROCHURE', 'DENGAGE_TX_PUSH_BROCHURE'),
        subject="The {%= $Current.model %} details, in one place",
        preheader='Everything you were reading, kept for whenever you come back.',
        kicker='Specifications',
        headline="The {%= $Current.model %} details, kept for you",
        lead="Here is the model you were reading about. The full specification sits on its page, and "
             "the showroom team can walk you through any part of it.",
        detail_pairs=SHORT_ROWS,
        cta_label='Open the model page',
        cta_tag=RANGE_URL,
        closing='When you would rather feel it than read it, a drive takes twenty minutes.',
        push_title="The {%= $Current.model %} details",
        push_body='Everything you were reading, kept in one place for you.',
        push_url=RANGE_URL,
    ),
    dict(
        slug='newsletter-welcome',
        moment='newsletter',
        title='Newsletter signup',
        trigger='when the updates card is accepted anywhere on the storefront',
        env=('DENGAGE_TX_EMAIL_NEWSLETTER', 'DENGAGE_TX_PUSH_NEWSLETTER'),
        subject='Lincoln news, first',
        preheader='New arrivals, seasonal offers and showroom events. Nothing else.',
        kicker='Welcome',
        headline='Lincoln news reaches you first',
        lead="Thank you for joining. New arrivals, seasonal offers and showroom events from Mohamed "
             "Yousuf Naghi Motors, and nothing else.",
        detail_pairs=[('Reading about', '$Current.model'), ('City', '$Current.city')],
        cta_label='See the range',
        cta_tag=RANGE_URL,
        closing='You can step off the list at any time using the link at the foot of this message.',
        push_title='You are on the list',
        push_body='New arrivals and offers from Mohamed Yousuf Naghi Motors, first.',
        push_url=RANGE_URL,
    ),
    dict(
        slug='survey-thanks',
        moment='survey',
        title='Survey answered',
        trigger='when the shopping survey card is answered',
        env=('DENGAGE_TX_EMAIL_SURVEY', 'DENGAGE_TX_PUSH_SURVEY'),
        subject='Thank you, that reaches the right people',
        preheader='Your answer is on your profile before anyone picks up the phone.',
        kicker='Thank you',
        headline='That helps, and it reaches the right people',
        lead="Your answer is on your profile now, so the showroom team can see what matters to you "
             "before they pick up the phone.",
        detail_pairs=[('Model', '$Current.model'), ('You told us', '$Current.purchase_horizon')],
        cta_label='Back to the range',
        cta_tag=RANGE_URL,
        closing='If a drive would help you decide, we can arrange one this week.',
        push_title='Thank you',
        push_body='Your answer is with the showroom team, on your profile.',
        push_url=RANGE_URL,
    ),
    dict(
        slug='showroom-visit',
        moment='showroom_visit',
        title='Walk in logged at the showroom',
        trigger='when reception logs the visitor on the dealer cockpit',
        env=('DENGAGE_TX_EMAIL_WALKIN', 'DENGAGE_TX_PUSH_WALKIN'),
        subject='Good to meet you at the showroom',
        preheader='Whatever you saw today, the team can carry it forward.',
        kicker='Thank you for visiting',
        headline='Good to meet you at the showroom',
        lead="{% if ($Current.first_name) { %}Thank you for coming in, {%= $Current.first_name %}."
             "{% } else { %}Thank you for coming in today.{% } %} Whatever you saw, the team can "
             "carry it forward: a drive, some figures, or a second look without the rush.",
        detail_pairs=VISIT_ROWS,
        cta_label='Book a drive',
        cta_tag=FORM_URL,
        closing='No answer needed. This is simply so you have us to hand.',
        push_title='Good to meet you',
        push_body='Thank you for visiting us today. We are here whenever you want a drive.',
        push_url=FORM_URL,
    ),
    dict(
        slug='test-drive-done',
        moment='test_drive_done',
        title='Test drive completed',
        trigger='when the cockpit records that the keys came back',
        env=('DENGAGE_TX_EMAIL_TD_DONE', 'DENGAGE_TX_PUSH_TD_DONE'),
        subject="How was the {%= $Current.model %}?",
        preheader='Tell us what you thought. There is no pressure attached.',
        kicker='After the drive',
        headline="How was the {%= $Current.model %}?",
        lead="Thank you for driving with us today. Whatever you made of it, the team would like to "
             "hear, and there is no pressure attached to the answer.",
        detail_pairs=SHORT_ROWS,
        cta_label='Talk to the team',
        cta_tag=CONTACT_URL,
        closing='If it was the right car, the next conversation is a short one.',
        push_title="How was the {%= $Current.model %}?",
        push_body='Tell us what you thought. There is no pressure attached.',
        push_url=CONTACT_URL,
    ),
    dict(
        slug='no-show-reinvite',
        moment='no_show',
        title='Booked but did not arrive',
        trigger='when the cockpit records that a booked drive was missed',
        env=('DENGAGE_TX_EMAIL_NOSHOW', 'DENGAGE_TX_PUSH_NOSHOW'),
        subject="The {%= $Current.model %} is still waiting for you",
        preheader='The car is here, and so is a slot whenever you want one.',
        kicker='Another time?',
        headline="The {%= $Current.model %} is still waiting for you",
        lead="We had a drive set aside and the day got away from you. It happens. The car is here, "
             "and so is a slot, whenever suits you better.",
        detail_pairs=SHORT_ROWS,
        cta_label='Pick a new time',
        cta_tag=FORM_URL,
        closing='Or reply with a day that works and the showroom will do the rest.',
        push_title='Another time?',
        push_body="The {%= $Current.model %} is still here whenever you are.",
        push_url=FORM_URL,
    ),
    dict(
        slug=None,
        moment='inbox_message',
        title='A message waiting in the app inbox',
        trigger='on demand from the API, to fill the storefront drawer during a call',
        env=(None, 'DENGAGE_TX_PUSH_INBOX'),
        push_title='A message is waiting for you',
        push_body="Open the {%= $Current.model %} page to read it in your inbox.",
        push_url=RANGE_URL,
    ),
]


def push_section(m):
    push_env = m['env'][1]
    title, body = m['push_title'], m['push_body']
    longest = lambda t: len(t.replace('{%= $Current.model %}', 'Navigator'))
    return f"""### {m['title']}

Sent {m['trigger']}. Its content id goes in `{push_env}`.

| Field | Value |
|---|---|
| Title | `{title}` |
| Message | `{body}` |
| Target URL | `{m['push_url']}` |
| Media | `{{%= $Current.model_image %}}` |

With the longest model name in place that is {longest(title)} characters of title and {longest(body)} of message.
"""


def readme():
    lines = []
    for m in MOMENTS:
        email_env, push_env = m['env']
        email_cell = f'`{m["slug"]}.html`' if m['slug'] else 'push only'
        env_cell = f'`{email_env}`<br>`{push_env}`' if email_env else f'`{push_env}`'
        lines.append(f'| {m["title"]} | `{m["moment"]}` | {email_cell} | {env_cell} |')
    table = '\n'.join(lines)
    return f"""# The Lincoln demo's messages

Ten moments, each one a thing a visitor does that earns an immediate reply.
Nine of them send an email and a push together; the tenth is push only.

Everything here is content to create in the Dengage panel. Nothing in this
folder is served by the site, and nothing here is read at runtime: the panel
holds the content, and the demo calls the transactional API with a content id
and the values the message prints.

## What to create, and where its id goes

| Moment | Sent as | Email body | Content id variable |
|---|---|---|---|
{table}

Push copy for all ten is in [PUSH.md](PUSH.md), one section each.

Once a content exists, set its public id on the message function and that
moment starts sending. Nothing else changes: a moment with no id configured
reports `needs content` and sends nothing, which is why the set can be filled
in one at a time.

    supabase secrets set DENGAGE_TX_EMAIL_QUOTE=<public id> --project-ref <ref>

The function's health check lists the state of every moment at once:

    curl -s https://<ref>.supabase.co/functions/v1/nissan-booking-confirm \\
         -H "authorization: Bearer <anon key>" | python3 -m json.tool

## The values a message can print

These travel in the API call, so they are addressed as `$Current`. A
transactional send cannot read the contact record, so `$Contact` tags stay
empty here and are not used.

| Tag | What it holds | Always sent? |
|---|---|---|
| `$Current.model` | Navigator, Aviator, Corsair, or Lincoln when no car is in play | yes |
| `$Current.model_url` | that model's page on the demo | yes |
| `$Current.model_image` | that model's banner, or the brand's own concept interior when no car is in play. JPEG, near enough 2:1 for a rich push | yes |
| `$Current.booking_url` | the test drive form, with the model already chosen where there is one | yes |
| `$Current.model_seats` | the seat count the source site publishes | with a known model |
| `$Current.model_category` | SUV | with a known model |
| `$Current.first_name` | what the visitor typed | when given |
| `$Current.full_name` | first and last together | when given |
| `$Current.gsm` | the mobile number | when given |
| `$Current.email` | the address | when given |
| `$Current.city` | the city chosen on the form | when given |
| `$Current.branch` | the showroom | when the moment has one |
| `$Current.purchase_horizon` | when they plan to buy | when given |
| `$Current.booking_ref` | the reference the demo issued | bookings only |

The four marked always are the ones used in a push title, a Target URL and the
Media field. Those fields carry no branch, so an empty value would leave a
visible hole, and the way to be sure of them is for the function to send one
every time. The rest appear only inside `{{% if (...) {{ %}} ... {{% }} %}}`,
because a city, a showroom or a purchase horizon has no honest stand in, and a
message should say nothing rather than guess.

## The three tag forms

    {{%= $Current.model %}}                 print it
    {{%= $Current.model_url || 'https://...' %}}   print it, or this if it is empty
    {{% if ($Current.city) {{ %}} ... {{% }} %}}      print this part only if it is there

## Before trusting a template

`_tag-check.html` prints every value a send can see, one per line, in
brackets. Paste it as a throwaway email content, fire one booking at yourself,
and the message settles in one look whether a tag resolves. It answers the
question the panel preview cannot: the preview has no `$Current` to read.

## Regenerating

Every file in this folder, including this one, comes from a single script, so
the whole set stays consistent. Edit the script rather than the output:

    python3 tools/build-lincoln-emails.py
"""


PUSH_HEADER = """# The push copy for each moment

Content > Push > new content, one per moment. Ten of them, listed in the order
a visitor meets them.

The values are the same ones the email uses, in the same tag form, because the
message function sends them on both channels. None of this copy branches: every
tag below is one the function always fills, so the words read correctly whether
or not the visitor has told us anything. A notification that renders a gap where
the car should be is the first thing a visitor sees, and sending a value every
time is the only way to be sure of that.

Keep a title under about 50 characters and a message under about 120, or a
phone truncates it mid sentence. The counts under each entry are measured with
the longest model name in place.

Every push also lands in the storefront's inbox drawer, because the function
sends it with inbox parameters and a thirty day life. There is no separate
inbox copy to write: the push content is what the drawer shows.

"""


TAG_CHECK = """<!-- Paste this as a throwaway email content and send one booking to yourself.
     It prints what a transactional send can actually see, which settles in one
     message whether a tag resolves before ten templates depend on it. The panel
     preview cannot answer this: it has no $Current to read. Delete the content
     afterwards. -->
<div style="font:400 13px/1.7 Courier New,monospace;color:#1c1f21">
  <p><b>What this send can see</b></p>
  <p>model: [{%= $Current.model %}]</p>
  <p>model_id: [{%= $Current.model_id %}]</p>
  <p>model_seats: [{%= $Current.model_seats %}]</p>
  <p>model_category: [{%= $Current.model_category %}]</p>
  <p>model_url: [{%= $Current.model_url %}]</p>
  <p>model_image: [{%= $Current.model_image %}]</p>
  <p>booking_url: [{%= $Current.booking_url %}]</p>
  <p>first_name: [{%= $Current.first_name %}]</p>
  <p>full_name: [{%= $Current.full_name %}]</p>
  <p>email: [{%= $Current.email %}]</p>
  <p>gsm: [{%= $Current.gsm %}]</p>
  <p>city: [{%= $Current.city %}]</p>
  <p>branch: [{%= $Current.branch %}]</p>
  <p>purchase_horizon: [{%= $Current.purchase_horizon %}]</p>
  <p>booking_ref: [{%= $Current.booking_ref %}]</p>
  <p>a fallback on an empty value: [{%= $Current.not_sent || 'the fallback printed' %}]</p>
  <p>a condition on an empty value: [{% if ($Current.not_sent) { %}printed{% } else { %}skipped{% } %}]</p>
  <p>the contact record, which a transactional send cannot read: [{%= $Contact.name %}]</p>
</div>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for m in MOMENTS:
        if not m['slug']:
            continue
        (OUT / (m['slug'] + '.html')).write_text(email(**m), encoding='utf-8')
        written += 1
    push = PUSH_HEADER + '\n'.join(push_section(m) for m in MOMENTS)
    (OUT / 'PUSH.md').write_text(push, encoding='utf-8')
    (OUT / 'README.md').write_text(readme(), encoding='utf-8')
    (OUT / '_tag-check.html').write_text(TAG_CHECK, encoding='utf-8')
    print(f'wrote {written} email bodies, push copy for {len(MOMENTS)} moments, '
          f'README.md and _tag-check.html to panel/lincoln/')


if __name__ == '__main__':
    main()
