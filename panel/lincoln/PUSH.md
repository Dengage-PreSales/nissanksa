# The push copy for each moment

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

Every message carries the model's own photograph in the Media field.

**The inbox does not fill from these, and an earlier version of this page said
it did.** Every send carries the inbox parameters the API documents, and they
change nothing here: two pushes fired at a contact holding twenty inbox
messages left the count at twenty. In this account the drawer fills from a
campaign or a journey, not from a transactional send. The drawer itself is
real and reads correctly, so what it shows is whatever you have sent from the
panel.

### Test drive booked

Sent when the test drive form is submitted on the storefront. Its content id goes in `DENGAGE_TX_PUSH_CONTENT_ID`.

| Field | Value |
|---|---|
| Title | `Your {%= $Current.model %} drive is booked` |
| Message | `We have your request. The showroom will call you to agree a time.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 30 characters of title and 65 of message.

### Booking started and left

Sent when the visitor types into the booking form, then leaves without submitting. Its content id goes in `DENGAGE_TX_PUSH_ABANDONED`.

| Field | Value |
|---|---|
| Title | `One step left on your {%= $Current.model %}` |
| Message | `Your booking is nearly done. Pick it up where you left off.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 31 characters of title and 59 of message.

### Quote requested

Sent when the online quote form is submitted. Its content id goes in `DENGAGE_TX_PUSH_QUOTE`.

| Field | Value |
|---|---|
| Title | `Your {%= $Current.model %} quote is coming` |
| Message | `A specialist is putting your figures together right now.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 30 characters of title and 56 of message.

### Specification downloaded

Sent when a specification sheet is downloaded from a model page. Its content id goes in `DENGAGE_TX_PUSH_BROCHURE`.

| Field | Value |
|---|---|
| Title | `The {%= $Current.model %} details` |
| Message | `Everything you were reading, kept in one place for you.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 21 characters of title and 55 of message.

### Newsletter signup

Sent when the updates card is accepted anywhere on the storefront. Its content id goes in `DENGAGE_TX_PUSH_NEWSLETTER`.

| Field | Value |
|---|---|
| Title | `You are on the list` |
| Message | `New arrivals and offers reach you first.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 19 characters of title and 40 of message.

### Survey answered

Sent when the shopping survey card is answered. Its content id goes in `DENGAGE_TX_PUSH_SURVEY`.

| Field | Value |
|---|---|
| Title | `Thank you` |
| Message | `Your answer is with the showroom team, on your profile.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 9 characters of title and 55 of message.

### Walk in logged at the showroom

Sent when reception logs the visitor on the dealer cockpit. Its content id goes in `DENGAGE_TX_PUSH_WALKIN`.

| Field | Value |
|---|---|
| Title | `Good to meet you` |
| Message | `Thank you for visiting us today. We are here whenever you want a drive.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 16 characters of title and 71 of message.

### Test drive completed

Sent when the cockpit records that the keys came back. Its content id goes in `DENGAGE_TX_PUSH_TD_DONE`.

| Field | Value |
|---|---|
| Title | `How was the {%= $Current.model %}?` |
| Message | `Tell us what you thought. There is no pressure attached.` |
| Target URL | `https://dengage-presales.github.io/nissanksa/lincoln/contact-us/` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 22 characters of title and 56 of message.

### Booked but did not arrive

Sent when the cockpit records that a booked drive was missed. Its content id goes in `DENGAGE_TX_PUSH_NOSHOW`.

| Field | Value |
|---|---|
| Title | `Another time?` |
| Message | `The {%= $Current.model %} is still here whenever you are.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 13 characters of title and 45 of message.

### A message waiting in the app inbox

Sent on demand from the API, to fill the storefront drawer during a call. Its content id goes in `DENGAGE_TX_PUSH_INBOX`.

| Field | Value |
|---|---|
| Title | `A message is waiting for you` |
| Message | `Open the {%= $Current.model %} page to read it in your inbox.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | `{%= $Current.model_image %}` |

With the longest model name in place that is 28 characters of title and 49 of message.
