# How to verify every part of this demo

One sitting, about twenty five minutes, and it ends with each item either
proved or named as not done. Nothing here is a matter of judgement: each step
says exactly what to press and exactly what the answer should be.

**The one rule everything else rests on.** An HTTP 200 from Dengage means
accepted and nothing more. The proof an event landed is a row in Data Space,
and rows appear about two minutes after the click. A reading taken straight
after pressing something shows nothing and means nothing, which is the single
most likely way to talk yourself into believing this is broken when it is not.

Start here, and keep it open in its own tab throughout:

**<https://dengage-presales.github.io/nissanksa/verify/>**

It reads the demo's state out of Dengage and writes nothing. It also loads no
part of the demo, on purpose: a verification tool that fires its own page view
would appear in the numbers it is reporting.

---

## Part 1. The storefront, in one pass

Press **Take a baseline** on the console first. Then walk this. Roughly ten
minutes.

| # | Do this | It worked if |
|---|---|---|
| 1 | Open [the home page](https://dengage-presales.github.io/nissanksa/) | The Dengage mark is top left, never Nissan's |
| 2 | Search for `patrol` in the header | Results appear in place, no page reload |
| 3 | Press a heart on any car in the grid | It fills, and the car is saved |
| 4 | Open [the X-TRAIL page](https://dengage-presales.github.io/nissanksa/vehicles/x-trail/) and press **Watch the price** | It confirms, and the car joins the watch list |
| 5 | Open [Build and reserve](https://dengage-presales.github.io/nissanksa/configure/?model=x-trail) | Seven X-TRAIL grades, real prices, one saying **Price on request** |
| 6 | Choose a grade, then a different one | The summary follows your choice and shows one car, not two |
| 7 | Press **Reserve this build**, fill it in, confirm | The build is held, and a message arrives in the bell drawer |
| 8 | Open [Compare](https://dengage-presales.github.io/nissanksa/compare/), pick two cars | They line up with published figures |
| 9 | Open [Find your Nissan](https://dengage-presales.github.io/nissanksa/find-your-nissan/), answer all three | The range narrows, and TEKTON is named separately as unpriced |
| 10 | Open [My Showroom](https://dengage-presales.github.io/nissanksa/my-showroom/) | Your saved car, your price watch, what you viewed and the car you built |
| 11 | Press **Not this one** on the build | It disappears |
| 12 | Open [the dealer cockpit](https://dengage-presales.github.io/nissanksa/dealer/), pick DPS-1, log a walk in, then cancel the test drive | Each reports what it wrote in the log pane |

Then wait two minutes and press **Read again** on the console.

**Every one of the seven tables should have moved.** If one has not, that call
did not happen. Add `?debug=1` to any demo page and the readout at the bottom
left names every event that page sent and the table each one writes to.

---

## Part 2. Anonymous and known

The demo's whole argument is that it works before anyone has a name, so this is
worth proving rather than asserting.

1. Open the demo in a **private window**. Browse two models, save one, search.
2. Open [My Showroom](https://dengage-presales.github.io/nissanksa/my-showroom/)
   in that same private window. Everything you just did is there, and the line
   at the top says nobody knows your name yet.
3. Now open [the demo as DPS-1](https://dengage-presales.github.io/nissanksa/?ck=DPS-1)
   and book a test drive. The confirmation arrives against that contact.

**The one thing to confirm in the panel before claiming it on a call.** Open
DPS-1's contact card and look for page views from *before* they were named. The
device keeps its id across that moment and the SDK rebinds it, but the event
rows stay keyed by the device on both sides, so the merge is Dengage's identity
resolution doing it server side rather than anything this demo performs. If the
earlier views are on the card, tell the merge story outright. If they are not,
tell it as the device history the profile is built from, which is still true.

---

## Part 3. Your panel work, item by item

Each of these has a way to check it that does not involve trusting a green tick
in a form.

### The ten email bodies

Set a content id, then press **Read the moments** on the console. That moment's
Nissan column flips from `no email, push` to `email, push`. If it does not, the
id did not take.

To see the email itself: book a test drive on the demo using a real address you
can open. It arrives within seconds, opens with the car's photograph, and is
Nissan red on black. If it is amber, an old copy of the body was pasted.

### The push contents, and what the Media field is

Both push contents are created and their ids are wired, so this is the last
thing left on the messages.

**Where the field is.** Panel > **Content > Push**, open any one of the push
contents you created, and it has a **Media** slot alongside Title, Message and
Target URL. It is the picture the notification shows. Most people fill it by
uploading an image, which is exactly what you do not want here, because the
picture has to be a different car for each send.

**What to put in it**, verbatim, instead of uploading anything:

    {%= $Current.model_image %}

That is a template tag, not a filename. The message function sends a
`model_image` value with every message, resolved from the car in play, so the
same content shows a Patrol to someone who booked a Patrol and an Altima to
someone who booked an Altima. The tag for each moment is in
[PUSH.md](nissan/PUSH.md) under that moment's Media row, and it is the same tag
every time.

**Do it once for both demos.** Every push content is shared between Nissan and
Lincoln except the newsletter, and both send their own `model_image`, so
setting the tag on the shared contents serves the Lincoln demo at the same time.

**How you know it worked.** Book a test drive on the demo in a browser where
you have allowed notifications. The notification arrives within seconds with
the car's photograph in it. No photograph means the field did not save, or an
upload is sitting in it instead of the tag.

**One Target URL to correct while you are in there.** Open the push content
**Test drive completed** and change its Target URL to:

    {%= $Current.contact_url %}

It currently holds the Lincoln demo's contact address, typed in when that demo
was the only one using this content. The content is shared, so a Nissan visitor
tapping that notification landed on the Lincoln storefront. The tag resolves to
whichever demo sent the message: the showroom finder for Nissan, the contact
page for Lincoln. Found and fixed on 2 September; the function already sends
the value, so this one field is all that is left. Every other push content
already uses tags for its Target URL and needs nothing.

### The remote data source

**Only tables with a contact key can be connected at all.** A remote table has
to relate to `master_contact` or `master_device`, so anything about places or
cars rather than people is not offered. That rules out `ni_branch`,
`ni_dealer_stock` and `v_ni_stock_gap`, and it is not a fault in any of them.

Connect it, then build one segment on `v_ni_hot_leads` with no filter. It should
count **72**. Any other number means something is wrong, and **zero is the one
to understand**: these tables have row level security on, so a role without a
read policy gets no error at all. It connects, authenticates, and every query
answers nothing. The policies exist, so a zero here means the connection is
using some other login than `dengage_reader`.

The others, for reference: no shows 12, open quotes 43, upgrade candidates 228,
dealer leads 216, the merged contact view 508, and `v_ni_contact_stock` 214, of
whom 40 want a car their own branch does not have.

### The journeys

Trigger each one from the demo rather than from a test send.

| Journey | Fire it by | It worked if |
|---|---|---|
| Booking confirmation | booking a test drive | the push arrives within seconds |
| Abandoned booking | starting a booking and leaving | the rescue arrives after the wait window |
| Welcome | booking as a new contact | one welcome message, once |
| Quote follow up | the open quotes segment | it enters on the next evaluation |
| No show re invite | the cockpit's no show button | it enters on the next evaluation |

A journey that has not fired by rehearsal is shown as its canvas on the call and
said plainly. That is the standing rule and it has never cost a meeting.

### The lead events table

Confirmed on 2 September: `ni_lead_events` exists and is filling. Nothing to do.

It is worth knowing what the check was, because it is silent when it fails: if
the table did not exist, every custom row would be accepted and stored nowhere
and the demo would look perfectly fine from the browser. The console's count
reads **not found in Data Space** in that case.

---

## Part 4. What the repository checks by itself

Before every push, and worth running if you change anything:

    python3 -m http.server 8101 &
    node tools/verify.mjs          # 44 assertions on the Nissan build
    node tools/verify-lincoln.mjs  # 55 on Lincoln
    node tools/audit.mjs           # every control and image, all 26 pages
    node tools/audit-mobile.mjs    # the same at a phone viewport

The browser checks refuse the Dengage hosts and assert the refusal, so a run
never writes into the shared account. That is why they cannot prove an event
reached Dengage, and why Part 1 exists.
