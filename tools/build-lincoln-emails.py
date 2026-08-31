#!/usr/bin/env python3
"""Emits the email bodies and push copy for the Lincoln demo's messages.

Every file under panel/lincoln/ is content to paste into the Dengage panel,
one per moment the storefront can message on. They are generated rather than
hand written so the nine stay consistent: same frame, same palette, same
footer, and the same personalization tags in the same order.

The tags are the panel's own template language:

    {%= $Current.model %}     a value passed by the API call that triggers it
    {%= $Contact.name %}      a column on the contact record
    {%= a || b %}             the fallback when a value was not sent

Only $Current is available to a transactional send, which is why every value
these bodies use travels in the API call rather than being read from the
contact. tools/../supabase/functions/nissan-booking-confirm sends them.

Run from the repository root:  python3 tools/build-lincoln-emails.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'panel' / 'lincoln'

SLATE, BRONZE, INK, MUTED, LINE, PAGE = '#324047', '#b45f1a', '#1c1f21', '#5b6770', '#ecebe8', '#f5f4f2'

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


def email(kicker, headline, lead, detail_pairs, cta_label, cta_tag, closing, hero=True):
    detail = rows(detail_pairs)
    hero_block = f"""      <tr><td style="padding:0">
        {{% if ($Current.model_image) {{ %}}
        <img src="{{%= $Current.model_image %}}" width="520" alt="{{%= $Current.model || 'Lincoln' %}}"
             style="display:block;width:100%;max-width:520px;height:auto;border:0">
        {{% }} %}}
      </td></tr>""" if hero else ''
    preheader = lead[:90]
    return f"""<!-- Paste this into Content > Email > new content, HTML source.
     Subject:    {headline}
     Preheader:  {preheader}
     Every {{%= $Current.x %}} below is sent by the booking confirmation function.
     A value that was not sent prints its fallback, never the word undefined. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:0;padding:0;background:{PAGE}">
  <tr><td align="center" style="padding:26px 12px">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0"
           style="width:520px;max-width:520px;background:#ffffff;border-top:3px solid {BRONZE}">
{hero_block}
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
        <a href="{{%= {cta_tag} %}}"
           style="display:inline-block;padding:12px 26px;background:{SLATE};color:#ffffff;
                  font:400 14px/1 Arial,sans-serif;letter-spacing:.04em;text-decoration:none">
          {cta_label}
        </a>
      </td></tr>
      <tr><td style="padding:18px 28px 28px">
        <p style="margin:0;font:400 13px/1.65 Arial,sans-serif;color:{MUTED}">{closing}</p>
      </td></tr>
{FOOTER}
    </table>
  </td></tr>
</table>
"""


BOOKING_ROWS = [
    ('Model', "$Current.model"),
    ('Seats', "$Current.model_seats"),
    ('Name', "$Current.full_name"),
    ('Mobile', "$Current.gsm"),
    ('City', "$Current.city"),
    ('Showroom', "$Current.branch"),
    ('Buying', "$Current.purchase_horizon"),
    ('Reference', "$Current.booking_ref"),
]
SHORT_ROWS = [
    ('Model', "$Current.model"),
    ('Seats', "$Current.model_seats"),
    ('City', "$Current.city"),
    ('Showroom', "$Current.branch"),
]

MESSAGES = {
    'booking-confirmation': dict(
        kicker='Test drive booked',
        headline="Your {%= $Current.model || 'Lincoln' %} is reserved for a drive",
        lead="Thank you {%= $Current.first_name || 'for booking' %}. The team at Mohamed Yousuf Naghi "
             "Motors has your request and will call to agree a time.",
        detail_pairs=BOOKING_ROWS,
        cta_label='See the model again',
        cta_tag="$Current.model_url || 'https://dengage-presales.github.io/nissanksa/lincoln/'",
        closing='Anything to change before the drive? Reply to this message and the showroom team will pick it up.',
    ),
    'abandoned-booking': dict(
        kicker='Still interested?',
        headline="Your {%= $Current.model || 'Lincoln' %} booking is one step from done",
        lead="You started arranging a drive and did not finish. Nothing is lost: pick it up where you "
             "left off and the showroom takes it from there.",
        detail_pairs=SHORT_ROWS,
        cta_label='Finish my booking',
        cta_tag="$Current.booking_url || 'https://dengage-presales.github.io/nissanksa/lincoln/forms/testdrive/'",
        closing='If the timing is wrong, ignore this message and we will leave it there.',
    ),
    'quote-acknowledgement': dict(
        kicker='Quote requested',
        headline="Your {%= $Current.model || 'Lincoln' %} quote is being prepared",
        lead="Thank you {%= $Current.first_name || '' %}. A specialist at Mohamed Yousuf Naghi Motors is "
             "putting your figures together and will be in touch.",
        detail_pairs=SHORT_ROWS,
        cta_label='Explore the model',
        cta_tag="$Current.model_url || 'https://dengage-presales.github.io/nissanksa/lincoln/'",
        closing='A test drive can be arranged for the same visit if you would like one.',
    ),
    'brochure-delivery': dict(
        kicker='Specifications',
        headline="The {%= $Current.model || 'Lincoln' %} details, in one place",
        lead="Here is the model you were reading about. The full specification sheet is on its page, "
             "and the showroom team can walk you through any of it.",
        detail_pairs=SHORT_ROWS,
        cta_label='Open the model page',
        cta_tag="$Current.model_url || 'https://dengage-presales.github.io/nissanksa/lincoln/'",
        closing='When you are ready to feel it rather than read it, a drive takes twenty minutes.',
    ),
    'newsletter-welcome': dict(
        kicker='Welcome',
        headline='Lincoln news, first',
        lead="Thank you for joining. New arrivals, seasonal offers and showroom events from Mohamed "
             "Yousuf Naghi Motors, and nothing else.",
        detail_pairs=[('Interested in', "$Current.model")],
        cta_label='See the range',
        cta_tag="'https://dengage-presales.github.io/nissanksa/lincoln/'",
        closing='You can step off the list at any time using the link at the foot of this message.',
        hero=True,
    ),
    'survey-thanks': dict(
        kicker='Thank you',
        headline='That helps, and it reaches the right people',
        lead="Your answer is on your profile, so the showroom team sees what matters to you before "
             "they pick up the phone.",
        detail_pairs=[('Model', "$Current.model"), ('You told us', "$Current.purchase_horizon")],
        cta_label='Back to the range',
        cta_tag="$Current.model_url || 'https://dengage-presales.github.io/nissanksa/lincoln/'",
        closing='If a drive would help you decide, we can arrange one this week.',
    ),
    'showroom-visit': dict(
        kicker='Thank you for visiting',
        headline='Good to meet you at the showroom',
        lead="Thank you {%= $Current.first_name || 'for coming in' %}. Whatever you saw today, the "
             "team can carry it forward: a drive, figures, or a second look without the rush.",
        detail_pairs=[('Showroom', "$Current.branch"), ('City', "$Current.city"), ('Model', "$Current.model")],
        cta_label='Book a drive',
        cta_tag="$Current.booking_url || 'https://dengage-presales.github.io/nissanksa/lincoln/forms/testdrive/'",
        closing='No answer needed. This is simply so you have us to hand.',
    ),
    'test-drive-done': dict(
        kicker='After the drive',
        headline="How was the {%= $Current.model || 'Lincoln' %}?",
        lead="Thank you for driving with us today. Whatever you thought, the team would like to hear "
             "it, and there is no pressure attached to the answer.",
        detail_pairs=SHORT_ROWS,
        cta_label='Talk to the team',
        cta_tag="'https://dengage-presales.github.io/nissanksa/lincoln/contact-us/'",
        closing='If it was the right car, the next conversation is a short one.',
    ),
    'no-show-reinvite': dict(
        kicker='Another time?',
        headline="The {%= $Current.model || 'Lincoln' %} is still waiting for you",
        lead="We had a drive set aside and the day got away from you. It happens. The car is here, and "
             "so is a slot whenever you want one.",
        detail_pairs=SHORT_ROWS,
        cta_label='Pick a new time',
        cta_tag="$Current.booking_url || 'https://dengage-presales.github.io/nissanksa/lincoln/forms/testdrive/'",
        closing='Or reply with a day that suits and the showroom will do the rest.',
    ),
}

PUSH = """# The push copy for each moment

Content > Push > new content, one per moment. The same values the email uses
are available here, in the same tag form, because the confirmation function
sends them on both channels. Keep a push title under about 50 characters and
the message under about 120, or a phone truncates it mid sentence.

Target URL and Media both take a tag, so the notification lands on the page
for the car the visitor chose and carries its photograph.

| Moment | Title | Message |
|---|---|---|
| Test drive booked | Your {%= $Current.model %} drive is booked | We have your request. The showroom will call to agree a time. |
| Booking started and left | One step left on your {%= $Current.model %} | Your booking is nearly done. Pick it up where you left off. |
| Quote requested | Your {%= $Current.model %} quote is coming | A specialist is putting your figures together now. |
| Specification downloaded | The {%= $Current.model %} details | Everything you were reading, kept in one place for you. |
| Newsletter signup | You are on the list | New arrivals and offers from Mohamed Yousuf Naghi Motors. |
| Survey answered | Thank you | Your answer is with the showroom team. |
| Walk in logged | Good to meet you | Thank you for visiting {%= $Current.branch %} today. |
| Test drive completed | How was the {%= $Current.model %}? | Tell us what you thought. No pressure attached. |
| Booked but did not arrive | Another time? | The {%= $Current.model %} is still here whenever you are. |

**Target URL** for every one of them:

    {%= $Current.model_url || 'https://dengage-presales.github.io/nissanksa/lincoln/' %}

except the two that should land on the form:

    {%= $Current.booking_url || 'https://dengage-presales.github.io/nissanksa/lincoln/forms/testdrive/' %}

**Media** where the design carries an image:

    {%= $Current.model_image %}
"""

TAG_CHECK = """<!-- Paste this as a throwaway email content and send one booking to yourself.
     It prints what a transactional send can actually see, which settles in one
     message whether a tag resolves before nine templates depend on it. Delete
     the content afterwards. -->
<div style="font:400 13px/1.7 Courier New,monospace;color:#1c1f21">
  <p><b>What this send can see</b></p>
  <p>model as $Current: [{%= $Current.model %}]</p>
  <p>model_seats: [{%= $Current.model_seats %}]</p>
  <p>model_url: [{%= $Current.model_url %}]</p>
  <p>model_image: [{%= $Current.model_image %}]</p>
  <p>booking_url: [{%= $Current.booking_url %}]</p>
  <p>first_name: [{%= $Current.first_name %}]</p>
  <p>full_name: [{%= $Current.full_name %}]</p>
  <p>city: [{%= $Current.city %}]</p>
  <p>branch: [{%= $Current.branch %}]</p>
  <p>purchase_horizon: [{%= $Current.purchase_horizon %}]</p>
  <p>booking_ref: [{%= $Current.booking_ref %}]</p>
  <p>gsm: [{%= $Current.gsm %}]</p>
  <p>contact name from the record: [{%= $Contact.name %}]</p>
</div>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in MESSAGES.items():
        (OUT / (name + '.html')).write_text(email(**spec), encoding='utf-8')
    (OUT / 'PUSH.md').write_text(PUSH, encoding='utf-8')
    (OUT / '_tag-check.html').write_text(TAG_CHECK, encoding='utf-8')
    print(f'wrote {len(MESSAGES)} email bodies, PUSH.md and _tag-check.html to panel/lincoln/')


if __name__ == '__main__':
    main()
