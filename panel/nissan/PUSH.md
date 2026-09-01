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

Leave Media empty. This demo's capture has no per model artwork a message can use, and sending the wrong car's photograph is worse than sending none.

**Dengage's inbox does not fill from these, and an earlier version of this
page said it did.** Every send carries the inbox parameters the API documents,
and they change nothing here: two pushes fired at a contact holding twenty
inbox messages left the count at twenty. In this account Dengage's own drawer
fills from a campaign or a journey, not from a transactional send.

**The bell in the storefront still fills instantly**, because the demo carries
its own message centre beside it and the drawer shows one merged list. The
same moment that sends this push writes that message, so the bell moves while
the notification is still arriving. Nothing here needs configuring for it: see
"The bell drawer is one list from two sources" in ../README.md for what it is
and how to edit its copy.

### Test drive booked

Sent when the test drive form is submitted on the storefront. Its content id goes in `DENGAGE_TX_PUSH_NI_CONTENT_ID`.

| Field | Value |
|---|---|
| Title | `Your {%= $Current.model %} drive is booked` |
| Message | `We have your request. The showroom will call you to agree a time.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 30 characters of title and 65 of message.

### Quote requested

Sent when the online quote form is submitted. Its content id goes in `DENGAGE_TX_PUSH_NI_QUOTE`.

| Field | Value |
|---|---|
| Title | `Your {%= $Current.model %} quote is coming` |
| Message | `A specialist is putting your figures together right now.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 30 characters of title and 56 of message.

### Specification downloaded

Sent when a specification sheet is downloaded from a model page. Its content id goes in `DENGAGE_TX_PUSH_NI_BROCHURE`.

| Field | Value |
|---|---|
| Title | `The {%= $Current.model %} details` |
| Message | `Everything you were reading, kept in one place for you.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 21 characters of title and 55 of message.

### Newsletter signup

Sent when the updates card is accepted anywhere on the storefront. Its content id goes in `DENGAGE_TX_PUSH_NI_NEWSLETTER`.

| Field | Value |
|---|---|
| Title | `You are on the list` |
| Message | `New arrivals and offers reach you first.` |
| Target URL | `{%= $Current.model_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 19 characters of title and 40 of message.

### Walk in logged at the showroom

Sent when reception logs the visitor on the dealer cockpit. Its content id goes in `DENGAGE_TX_PUSH_NI_WALKIN`.

| Field | Value |
|---|---|
| Title | `Good to meet you` |
| Message | `Thank you for visiting us today. We are here whenever you want a drive.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 16 characters of title and 71 of message.

### Test drive completed

Sent when the cockpit records that the keys came back. Its content id goes in `DENGAGE_TX_PUSH_NI_TD_DONE`.

| Field | Value |
|---|---|
| Title | `How was the {%= $Current.model %}?` |
| Message | `Tell us what you thought. There is no pressure attached.` |
| Target URL | `https://dengage-presales.github.io/nissanksa/find-a-showroom/` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 22 characters of title and 56 of message.

### Booked but did not arrive

Sent when the cockpit records that a booked drive was missed. Its content id goes in `DENGAGE_TX_PUSH_NI_NOSHOW`.

| Field | Value |
|---|---|
| Title | `Another time?` |
| Message | `The {%= $Current.model %} is still here whenever you are.` |
| Target URL | `{%= $Current.booking_url %}` |
| Media | leave empty, this demo sends no photograph |

With the longest model name in place that is 13 characters of title and 45 of message.
