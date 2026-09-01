#!/usr/bin/env python3
"""Emits the ready to paste message content for every moment either demo sends.

Everything under panel/lincoln/ and panel/nissan/ is content for the Dengage
panel: one email body per moment, one push entry per moment, and the index that
says which content id belongs where. They are generated rather than hand
written so each set stays consistent: one frame, one palette, one footer, and
the same personalization tags in the same order.

The two demos share every push content, because that copy names no dealer and
only the values change. They never share an email: an email carries a dealer
name and a footer, and telling a Nissan visitor about a Lincoln showroom would
be worse than sending nothing.

The tags are the panel's own template language:

    {%= $Current.model %}     a value passed by the API call that triggers it
    {%= $Contact.name %}      a column on the contact record
    {%= a || b %}             the fallback used when a value was not sent
    {% if (a) { %} ... {% } %}   print this only when a value was sent

A transactional send can only see $Current, which is why every value these
messages use travels in the API call. supabase/functions/nissan-booking-confirm
sends them, and that function guarantees three of them are never empty for
either brand: model, model_url and booking_url, plus model_image where the
brand has artwork. Those are safe in a push title, in a Target URL and in the
Media field, where the copy carries no condition and an empty value would leave
a visible hole. Everything else is optional and is only ever printed inside a
condition.

Run from the repository root:  python3 tools/build-message-content.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

SLATE, BRONZE, INK, MUTED, LINE, PAGE = '#324047', '#b45f1a', '#1c1f21', '#5b6770', '#ecebe8', '#f5f4f2'

# The two destinations a message can send someone to. Both are tags the message
# function always fills, so they carry no fallback: a fallback on a value that
# is always sent is syntax nobody has tested standing in a field where a
# failure is silent.
RANGE_URL = '{%= $Current.model_url %}'
FORM_URL = '{%= $Current.booking_url %}'

DENGAGE_MARK = (
    '<span style="font:700 15px/1 Arial,sans-serif;letter-spacing:.14em;color:#ffffff">DENGAGE</span>'
    '<br><span style="font:400 9px/1.6 Arial,sans-serif;letter-spacing:.3em;color:#9aa3a8">AUTO DEMO</span>'
)


def footer(notice):
    return f"""      <tr><td style="padding:22px 28px 26px;background:{SLATE}">
        {DENGAGE_MARK}
        <p style="margin:14px 0 0;font:400 11.5px/1.7 Arial,sans-serif;color:#9aa3a8">
          {notice}
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


def email(brand, m):
    """One message in the shared frame: image where the brand has one, kicker,
       headline, lead, details, one action, one closing line, and the notice."""
    detail = rows([(label, tag) for label, tag in m['detail'](brand)])
    hero = f"""      <tr><td style="padding:0">
        <img src="{{%= $Current.model_image %}}" width="520" alt="{{%= $Current.model %}}"
             style="display:block;width:100%;max-width:520px;height:auto;border:0">
      </td></tr>
""" if brand['hero'] else ''
    fill = dict(at=brand['at'], of=brand['of'])
    return f"""<!-- {brand['label']} demo message. Paste the block below into
     Content > Email > new content > HTML source, and set:

       Subject    {m['subject']}
       Preheader  {m['preheader']}

     Every $Current value below is sent by the message function. model,
     model_url and booking_url are always sent, so they need no fallback; the
     rest print only when the visitor gave them. Nothing here reads the contact
     record, because a transactional send cannot see it. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:0;padding:0;background:{PAGE}">
  <tr><td align="center" style="padding:26px 12px">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0"
           style="width:520px;max-width:520px;background:#ffffff;border-top:3px solid {BRONZE}">
{hero}      <tr><td style="padding:30px 28px 8px">
        <p style="margin:0 0 10px;font:400 11px/1 Arial,sans-serif;letter-spacing:.18em;
                  text-transform:uppercase;color:{BRONZE}">{m['kicker']}</p>
        <h1 style="margin:0 0 12px;font:600 23px/1.25 Georgia,'Times New Roman',serif;color:{SLATE}">
          {m['headline']}
        </h1>
        <p style="margin:0 0 20px;font:400 14.5px/1.65 Arial,sans-serif;color:{MUTED}">
          {m['lead'].format(**fill)}
        </p>
      </td></tr>
      <tr><td style="padding:0 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{detail}
        </table>
      </td></tr>
      <tr><td style="padding:24px 28px 6px">
        <a href="{m['cta_href'](brand)}"
           style="display:inline-block;padding:12px 26px;background:{SLATE};color:#ffffff;
                  font:400 14px/1 Arial,sans-serif;letter-spacing:.04em;text-decoration:none">
          {m['cta']}
        </a>
      </td></tr>
      <tr><td style="padding:18px 28px 28px">
        <p style="margin:0;font:400 13px/1.65 Arial,sans-serif;color:{MUTED}">{m['closing']}</p>
      </td></tr>
{footer(brand['notice'])}
    </table>
  </td></tr>
</table>
"""


# The detail lines a message carries. Every tag is optional, so a row prints
# only when the visitor actually gave that value. The second line is whichever
# figure the brand's own site publishes: Lincoln publishes seat counts and no
# prices, Nissan publishes starting prices and no seat counts.
def booking_rows(b):
    return [('Model', '$Current.model'), b['figure'], ('Name', '$Current.full_name'),
            ('Mobile', '$Current.gsm'), ('City', '$Current.city'), ('Showroom', '$Current.branch'),
            ('Buying', '$Current.purchase_horizon'), ('Reference', '$Current.booking_ref')]


def short_rows(b):
    return [('Model', '$Current.model'), b['figure'],
            ('City', '$Current.city'), ('Showroom', '$Current.branch')]


def visit_rows(b):
    return [('Showroom', '$Current.branch'), ('City', '$Current.city'),
            ('Model', '$Current.model'), b['figure']]


CONTACT = lambda b: b['origin'] + b['contact']

# One entry per moment. `slug` is the file and the moment name the function
# uses; `env` is the pair of variables that carry the content ids; `trigger`
# is the thing the visitor does that sends it.
MOMENTS = [
    dict(
        key='booking', slug='booking-confirmation', label='Test drive booked',
        trigger='when the test drive form is submitted on the storefront',
        env=('EMAIL_CONTENT_ID', 'PUSH_CONTENT_ID'),
        subject="Your {%= $Current.model %} test drive is booked",
        preheader='The showroom has your request and will call to agree a time.',
        kicker='Test drive booked',
        headline="Your {%= $Current.model %} is reserved for a drive",
        lead="{{% if ($Current.first_name) {{ %}}Thank you {{%= $Current.first_name %}}. The team{{% }} "
             "else {{ %}}Thank you. The team{{% }} %}}{at} has your request and will call to agree "
             "a time that suits you.",
        detail=booking_rows, cta='See the model again', cta_href=lambda b: RANGE_URL,
        closing='Anything to change before the drive? Reply to this message and the showroom team will pick it up.',
        push_title="Your {%= $Current.model %} drive is booked",
        push_body='We have your request. The showroom will call you to agree a time.',
        push_url=FORM_URL,
    ),
    dict(
        key='abandoned_booking', slug='abandoned-booking', label='Booking started and left',
        trigger='when the visitor types into the booking form, then leaves without submitting',
        env=('EMAIL_ABANDONED', 'PUSH_ABANDONED'),
        subject="One step left on your {%= $Current.model %}",
        preheader='Your booking is saved. Pick it up where you left off.',
        kicker='Still interested?',
        headline="Your {%= $Current.model %} booking is one step from done",
        lead="You started arranging a drive and did not finish. Nothing is lost. Pick it up where "
             "you left off and the showroom takes it from there.",
        detail=short_rows, cta='Finish my booking', cta_href=lambda b: FORM_URL,
        closing='If the timing is wrong, ignore this message and we will leave it there.',
        push_title="One step left on your {%= $Current.model %}",
        push_body='Your booking is nearly done. Pick it up where you left off.',
        push_url=FORM_URL,
    ),
    dict(
        key='quote', slug='quote-acknowledgement', label='Quote requested',
        trigger='when the online quote form is submitted',
        env=('EMAIL_QUOTE', 'PUSH_QUOTE'),
        subject="Your {%= $Current.model %} quote is being prepared",
        preheader='A specialist is putting your figures together now.',
        kicker='Quote requested',
        headline="Your {%= $Current.model %} quote is on its way",
        lead="{{% if ($Current.first_name) {{ %}}Thank you {{%= $Current.first_name %}}. A specialist{{% }} "
             "else {{ %}}Thank you. A specialist{{% }} %}}{at} is putting your figures together "
             "and will be in touch with them.",
        detail=short_rows, cta='Explore the model', cta_href=lambda b: RANGE_URL,
        closing='A test drive can be arranged for the same visit if you would like one.',
        push_title="Your {%= $Current.model %} quote is coming",
        push_body='A specialist is putting your figures together right now.',
        push_url=RANGE_URL,
    ),
    dict(
        key='brochure', slug='brochure-delivery', label='Specification downloaded',
        trigger='when a specification sheet is downloaded from a model page',
        env=('EMAIL_BROCHURE', 'PUSH_BROCHURE'),
        subject="The {%= $Current.model %} details, in one place",
        preheader='Everything you were reading, kept for whenever you come back.',
        kicker='Specifications',
        headline="The {%= $Current.model %} details, kept for you",
        lead="Here is the model you were reading about. The full specification sits on its page, and "
             "the showroom team can walk you through any part of it.",
        detail=short_rows, cta='Open the model page', cta_href=lambda b: RANGE_URL,
        closing='When you would rather feel it than read it, a drive takes twenty minutes.',
        push_title="The {%= $Current.model %} details",
        push_body='Everything you were reading, kept in one place for you.',
        push_url=RANGE_URL,
    ),
    dict(
        key='newsletter', slug='newsletter-welcome', label='Newsletter signup',
        trigger='when the updates card is accepted anywhere on the storefront',
        env=('EMAIL_NEWSLETTER', 'PUSH_NEWSLETTER'),
        subject='News, first',
        preheader='New arrivals, seasonal offers and showroom events. Nothing else.',
        kicker='Welcome',
        headline='The news reaches you first',
        lead="Thank you for joining. New arrivals, seasonal offers and showroom events from {of}, "
             "and nothing else.",
        detail=lambda b: [('Reading about', '$Current.model'), ('City', '$Current.city')],
        cta='See the range', cta_href=lambda b: RANGE_URL,
        closing='You can step off the list at any time using the link at the foot of this message.',
        push_title='You are on the list',
        push_body='New arrivals and offers reach you first.',
        push_url=RANGE_URL,
        dealer_in_push=True,
    ),
    dict(
        key='survey', slug='survey-thanks', label='Survey answered',
        trigger='when the shopping survey card is answered',
        env=('EMAIL_SURVEY', 'PUSH_SURVEY'),
        subject='Thank you, that reaches the right people',
        preheader='Your answer is on your profile before anyone picks up the phone.',
        kicker='Thank you',
        headline='That helps, and it reaches the right people',
        lead="Your answer is on your profile now, so the showroom team can see what matters to you "
             "before they pick up the phone.",
        detail=lambda b: [('Model', '$Current.model'), ('You told us', '$Current.purchase_horizon')],
        cta='Back to the range', cta_href=lambda b: RANGE_URL,
        closing='If a drive would help you decide, we can arrange one this week.',
        push_title='Thank you',
        push_body='Your answer is with the showroom team, on your profile.',
        push_url=RANGE_URL,
    ),
    dict(
        key='showroom_visit', slug='showroom-visit', label='Walk in logged at the showroom',
        trigger='when reception logs the visitor on the dealer cockpit',
        env=('EMAIL_WALKIN', 'PUSH_WALKIN'),
        subject='Good to meet you at the showroom',
        preheader='Whatever you saw today, the team can carry it forward.',
        kicker='Thank you for visiting',
        headline='Good to meet you at the showroom',
        lead="{{% if ($Current.first_name) {{ %}}Thank you for coming in, {{%= $Current.first_name %}}."
             "{{% }} else {{ %}}Thank you for coming in today.{{% }} %}} Whatever you saw, the team can "
             "carry it forward: a drive, some figures, or a second look without the rush.",
        detail=visit_rows, cta='Book a drive', cta_href=lambda b: FORM_URL,
        closing='No answer needed. This is simply so you have us to hand.',
        push_title='Good to meet you',
        push_body='Thank you for visiting us today. We are here whenever you want a drive.',
        push_url=FORM_URL,
    ),
    dict(
        key='test_drive_done', slug='test-drive-done', label='Test drive completed',
        trigger='when the cockpit records that the keys came back',
        env=('EMAIL_TD_DONE', 'PUSH_TD_DONE'),
        subject="How was the {%= $Current.model %}?",
        preheader='Tell us what you thought. There is no pressure attached.',
        kicker='After the drive',
        headline="How was the {%= $Current.model %}?",
        lead="Thank you for driving with us today. Whatever you made of it, the team would like to "
             "hear, and there is no pressure attached to the answer.",
        detail=short_rows, cta='Talk to the team', cta_href=CONTACT,
        closing='If it was the right car, the next conversation is a short one.',
        push_title="How was the {%= $Current.model %}?",
        push_body='Tell us what you thought. There is no pressure attached.',
        push_url=None,
    ),
    dict(
        key='no_show', slug='no-show-reinvite', label='Booked but did not arrive',
        trigger='when the cockpit records that a booked drive was missed',
        env=('EMAIL_NOSHOW', 'PUSH_NOSHOW'),
        subject="The {%= $Current.model %} is still waiting for you",
        preheader='The car is here, and so is a slot whenever you want one.',
        kicker='Another time?',
        headline="The {%= $Current.model %} is still waiting for you",
        lead="We had a drive set aside and the day got away from you. It happens. The car is here, "
             "and so is a slot, whenever suits you better.",
        detail=short_rows, cta='Pick a new time', cta_href=lambda b: FORM_URL,
        closing='Or reply with a day that works and the showroom will do the rest.',
        push_title='Another time?',
        push_body="The {%= $Current.model %} is still here whenever you are.",
        push_url=FORM_URL,
    ),
    dict(
        key='inbox_message', slug=None, label='A message waiting in the app inbox',
        trigger='on demand from the API, to fill the storefront drawer during a call',
        env=(None, 'PUSH_INBOX'),
        push_title='A message is waiting for you',
        push_body="Open the {%= $Current.model %} page to read it in your inbox.",
        push_url=RANGE_URL,
    ),
]


def for_brand(brand):
    keys = brand['moments']
    return [m for m in MOMENTS if keys is None or m['key'] in keys]


def push_section(brand, m):
    push_env = brand['env'](m['env'][1])
    title, body = m['push_title'], m['push_body']
    longest = lambda t: len(t.replace('{%= $Current.model %}', 'Navigator'))
    url = m['push_url'] or CONTACT(brand)
    media = ('| Media | `{%= $Current.model_image %}` |\n' if brand['hero'] else
             '| Media | leave empty, this demo sends no photograph |\n')
    return f"""### {m['label']}

Sent {m['trigger']}. Its content id goes in `{push_env}`.

| Field | Value |
|---|---|
| Title | `{title}` |
| Message | `{body}` |
| Target URL | `{url}` |
{media}
With the longest model name in place that is {longest(title)} characters of title and {longest(body)} of message.
"""


def readme(brand):
    lines = []
    for m in for_brand(brand):
        email_env, push_env = m['env']
        email_cell = f'`{m["slug"]}.html`' if m['slug'] else 'push only'
        cells = [brand['env'](e) for e in (email_env, push_env) if e]
        cells = [c for c in cells if c]
        env_cell = '<br>'.join(f'`{c}`' for c in cells) or 'shared with Lincoln'
        lines.append(f'| {m["label"]} | `{m["key"]}` | {email_cell} | {env_cell} |')
    table = '\n'.join(lines)
    figure_label, figure_tag = brand['figure']
    image_row = (f'| `$Current.model_image` | that model\'s banner, JPEG, near enough 2:1 for a rich push | yes |\n'
                 if brand['hero'] else
                 '| `$Current.model_image` | not sent by this demo. Its capture has no per model artwork a '
                 'message can use, and the wrong car is worse than no car | never |\n')
    return f"""# {brand['title']}

Everything here is content to create in the Dengage panel. Nothing in this
folder is served by the site, and nothing here is read at runtime: the panel
holds the content, and the demo calls the transactional API with a content id
and the values the message prints.

## The moments, and where each one's id lives

| Moment | Sent as | Email body | Content id variable |
|---|---|---|---|
{table}

Push copy is in [PUSH.md](PUSH.md), one section each.

The two demos share every push content, because that copy names no dealer and
only the values change between them. They never share an email: an email
carries a dealer name and a footer. So a push variable is only needed where
this demo wants copy of its own, and an email variable is needed for every
moment.

    supabase secrets set {brand['env']('EMAIL_QUOTE')}=<public id> --project-ref <ref>

The function's health check lists the state of every moment for both demos:

    curl -s https://<ref>.supabase.co/functions/v1/nissan-booking-confirm \\
         | python3 -m json.tool

## The values a message can print

These travel in the API call, so they are addressed as `$Current`. A
transactional send cannot read the contact record, so `$Contact` tags stay
empty here and are not used.

| Tag | What it holds | Always sent? |
|---|---|---|
| `$Current.model` | the model, or the brand name when no car is in play | yes |
| `$Current.model_url` | that model's page on the demo | yes |
| `$Current.booking_url` | the test drive form, with the model already chosen where there is one | yes |
{image_row}| `{figure_tag}` | {figure_label.lower()}, the figure this brand's own site publishes | with a known model |
| `$Current.model_category` | SUV, Sedan or Sports | with a known model |
| `$Current.first_name` | what the visitor typed | when given |
| `$Current.full_name` | first and last together | when given |
| `$Current.gsm` | the mobile number | when given |
| `$Current.email` | the address | when given |
| `$Current.city` | the city chosen on the form | when given |
| `$Current.branch` | the showroom | when the moment has one |
| `$Current.purchase_horizon` | when they plan to buy | when given |
| `$Current.booking_ref` | the reference the demo issued | bookings only |

The ones marked always are used in a push title, a Target URL and the Media
field. Those fields carry no branch, so an empty value would leave a visible
hole, and the way to be sure of them is for the function to send one every
time. The rest appear only inside `{{% if (...) {{ %}} ... {{% }} %}}`, because
a city, a showroom or a purchase horizon has no honest stand in, and a message
should say nothing rather than guess.

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

Every file in this folder, including this one, comes from a single script that
emits both demos' packs, so the whole set stays consistent. Edit the script
rather than the output:

    python3 tools/build-message-content.py
"""


def push_doc(brand):
    media_note = ('Every message carries the model\'s own photograph in the Media field.'
                  if brand['hero'] else
                  'Leave Media empty. This demo\'s capture has no per model artwork a message can use, '
                  'and sending the wrong car\'s photograph is worse than sending none.')
    return f"""# The push copy for each moment

Content > Push > new content, one per moment, listed in the order a visitor
meets them.

**These contents are shared with the other demo.** The copy names no dealer, so
one content serves both and only the values change. Create them once; only a
moment whose copy has to name a dealer needs a second version, and the message
function holds that one back rather than sending the wrong dealer's words.

None of this copy branches: every tag below is one the message function always
fills, so the words read correctly whether or not the visitor has told us
anything. A notification that renders a gap where the car should be is the
first thing a visitor sees, and sending a value every time is the only way to
be sure of that.

Keep a title under about 50 characters and a message under about 120, or a
phone truncates it mid sentence. The counts under each entry are measured with
the longest model name in place.

{media_note}

**The inbox does not fill from these, and an earlier version of this page said
it did.** Every send carries the inbox parameters the API documents, and they
change nothing here: two pushes fired at a contact holding twenty inbox
messages left the count at twenty. In this account the drawer fills from a
campaign or a journey, not from a transactional send. The drawer itself is
real and reads correctly, so what it shows is whatever you have sent from the
panel.

""" + '\n'.join(push_section(brand, m) for m in for_brand(brand))


TAG_CHECK = """<!-- Paste this as a throwaway email content and send one booking to yourself.
     It prints what a transactional send can actually see, which settles in one
     message whether a tag resolves before a dozen templates depend on it. The
     panel preview cannot answer this: it has no $Current to read. Delete the
     content afterwards. -->
<div style="font:400 13px/1.7 Courier New,monospace;color:#1c1f21">
  <p><b>What this send can see</b></p>
  <p>model: [{%= $Current.model %}]</p>
  <p>model_id: [{%= $Current.model_id %}]</p>
  <p>model_seats: [{%= $Current.model_seats %}]</p>
  <p>model_price: [{%= $Current.model_price %}]</p>
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

# What differs between the two demos. Everything else above is shared.
def nissan_env(name):
    """The variable this demo's moment actually reads, or None where it reads
    none. Nissan shares every push content with Lincoln except the newsletter,
    whose copy welcomes you to a named dealer, so naming a NI push variable for
    the others would send the reader to set something the function ignores."""
    if name == 'EMAIL_CONTENT_ID':
        return 'DENGAGE_TX_EMAIL_NI_BOOKING'
    if name.startswith('EMAIL_'):
        return 'DENGAGE_TX_' + name.replace('EMAIL_', 'EMAIL_NI_', 1)
    if name == 'PUSH_NEWSLETTER':
        return 'DENGAGE_TX_PUSH_NI_NEWSLETTER'
    return None


BRANDS = [
    dict(
        key='lincoln', label='Lincoln', title="The Lincoln demo's messages",
        origin='https://dengage-presales.github.io/nissanksa/lincoln/',
        contact='contact-us/',
        at=' at Mohamed Yousuf Naghi Motors', of='Mohamed Yousuf Naghi Motors',
        notice=('A demonstration message from a Dengage sales demo. Vehicle names and imagery come from the '
                'public Lincoln Saudi Arabia website of Mohamed Yousuf Naghi Motors. It is not sent for '
                'Lincoln or the dealer, and no booking was made with them.'),
        hero=True,
        # Lincoln's site publishes seat counts and no prices.
        figure=('Seats', '$Current.model_seats'),
        env=lambda name: 'DENGAGE_TX_' + name,
        moments=None,
    ),
    dict(
        key='nissan', label='Nissan', title="The Nissan demo's messages",
        origin='https://dengage-presales.github.io/nissanksa/',
        contact='find-a-showroom/',
        # The Nissan build names no dealer anywhere, so its messages do not
        # either: they say the showroom rather than inventing whose it is.
        at='', of='us',
        notice=('A demonstration message from a Dengage sales demo, built on the public Nissan Saudi Arabia '
                'website. It is not sent for Nissan or any dealer, and no booking was made with them.'),
        hero=False,
        # Nissan's site publishes starting prices and no seat counts.
        figure=('From', '$Current.model_price'),
        env=lambda name: nissan_env(name),
        # Every moment the Lincoln build has except the inbox message, which
        # is a notification and has no email counterpart in either demo. The
        # abandonment watcher and the survey card now run here too: they come
        # from js/creatives.js, which this demo gained on 1 September.
        moments=('booking', 'abandoned_booking', 'quote', 'brochure', 'newsletter',
                 'survey', 'showroom_visit', 'test_drive_done', 'no_show'),
    ),
]


def main():
    for brand in BRANDS:
        out = ROOT / 'panel' / brand['key']
        out.mkdir(parents=True, exist_ok=True)
        written = 0
        for m in for_brand(brand):
            if not m['slug']:
                continue
            (out / (m['slug'] + '.html')).write_text(email(brand, m), encoding='utf-8')
            written += 1
        (out / 'PUSH.md').write_text(push_doc(brand), encoding='utf-8')
        (out / 'README.md').write_text(readme(brand), encoding='utf-8')
        (out / '_tag-check.html').write_text(TAG_CHECK, encoding='utf-8')
        print(f'panel/{brand["key"]}: {written} email bodies, push copy for '
              f'{len(for_brand(brand))} moments, README.md and _tag-check.html')


if __name__ == '__main__':
    main()
