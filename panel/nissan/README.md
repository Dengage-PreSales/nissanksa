# The Nissan demo's messages

Everything here is content to create in the Dengage panel. Nothing in this
folder is served by the site, and nothing here is read at runtime: the panel
holds the content, and the demo calls the transactional API with a content id
and the values the message prints.

## The moments, and where each one's id lives

| Moment | Sent as | Email body | Content id variable |
|---|---|---|---|
| Test drive booked | `booking` | `booking-confirmation.html` | `DENGAGE_TX_EMAIL_NI_BOOKING` |
| Booking started and left | `abandoned_booking` | `abandoned-booking.html` | `DENGAGE_TX_EMAIL_NI_ABANDONED` |
| Quote requested | `quote` | `quote-acknowledgement.html` | `DENGAGE_TX_EMAIL_NI_QUOTE` |
| Specification downloaded | `brochure` | `brochure-delivery.html` | `DENGAGE_TX_EMAIL_NI_BROCHURE` |
| Newsletter signup | `newsletter` | `newsletter-welcome.html` | `DENGAGE_TX_EMAIL_NI_NEWSLETTER`<br>`DENGAGE_TX_PUSH_NI_NEWSLETTER` |
| Survey answered | `survey` | `survey-thanks.html` | `DENGAGE_TX_EMAIL_NI_SURVEY` |
| Walk in logged at the showroom | `showroom_visit` | `showroom-visit.html` | `DENGAGE_TX_EMAIL_NI_WALKIN` |
| Test drive completed | `test_drive_done` | `test-drive-done.html` | `DENGAGE_TX_EMAIL_NI_TD_DONE` |
| Booked but did not arrive | `no_show` | `no-show-reinvite.html` | `DENGAGE_TX_EMAIL_NI_NOSHOW` |

Push copy is in [PUSH.md](PUSH.md), one section each.

The two demos share every push content, because that copy names no dealer and
only the values change between them. They never share an email: an email
carries a dealer name and a footer. So a push variable is only needed where
this demo wants copy of its own, and an email variable is needed for every
moment.

    supabase secrets set DENGAGE_TX_EMAIL_NI_QUOTE=<public id> --project-ref <ref>

The function's health check lists the state of every moment for both demos:

    curl -s https://<ref>.supabase.co/functions/v1/nissan-booking-confirm \
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
| `$Current.model_image` | that model's banner, JPEG, near enough 2:1 for a rich push | yes |
| `$Current.model_price` | from, the figure this brand's own site publishes | with a known model |
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
time. The rest appear only inside `{% if (...) { %} ... {% } %}`, because
a city, a showroom or a purchase horizon has no honest stand in, and a message
should say nothing rather than guess.

## The three tag forms

    {%= $Current.model %}                 print it
    {%= $Current.model_url || 'https://...' %}   print it, or this if it is empty
    {% if ($Current.city) { %} ... {% } %}      print this part only if it is there

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
