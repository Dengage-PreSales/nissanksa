# The full walkthrough: one buyer, start to finish

Fifty three steps, about forty minutes, from a Google ad click to a car sold.
It is written for someone who has never opened the demo: every step says what
to press, what should happen, and what it proves. Nothing here is a matter of
judgement.

This is the long version. [VERIFY.md](VERIFY.md) is the twenty five minute one
that checks each item is wired. Use this when you want to see the whole story
in the order a real buyer meets it, or to rehearse a call.

**Three things before you start.**

1. **Use a private window.** The demo remembers a visitor, so a window that has
   already been through this is not a new visitor any more. A private window is
   the only reliable way to start from nothing.
2. **Open the console in a second tab** and press **Take a baseline**:
   <https://dengage-presales.github.io/nissanksa/verify/>
3. **Rows appear in Dengage about two minutes after a click.** A count read
   straight after pressing something shows nothing and means nothing. That is
   the single most likely way to talk yourself into thinking this is broken.

Throughout, `?debug=1` on any page draws a readout at the bottom left naming
every event that page sent and the table each one writes to. Leave it on. It
answers "did that button send anything, and what was in it" in one glance.

---

## Act 1. The Google ad click, and a visitor nobody has met

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 1 | Open the ad click:<br>`https://dengage-presales.github.io/nissanksa/?utm_source=google&utm_medium=cpc&utm_campaign=ksa_suv_always_on&utm_term=nissan+x-trail+price&gclid=DEMO-CPC-1&debug=1` | The Nissan home page, with the Dengage mark top left and never Nissan's | The visitor is counted from the first second, before anyone knows who they are. Today nobody knows the site's traffic at all |
| 2 | Look at the readout bottom left | One line: `pageView`, and the table it writes, `page_view_events` | Every page fires this first. It is what makes every later row findable |
| 3 | Nothing to press. The ad is remembered | The source, medium and campaign are held for this browser | When this person fills in a form later, the lead carries the ad that brought them. That is how the ad spend becomes accountable |
| 3a | Optional: open `?gclid=DEMO-2` on its own | Same result, source `google` | Google click ids survive redirect chains that eat utm tags. The demo reads either |
| 4 | Type `patrol` in the header box marked **Search NISSAN Site** | Results appear in place, no page reload | A search event, `search_events`. What people look for is an audience |
| 5 | Press the heart on any car in the grid, labelled **Save this car** | It fills | `wishlist_events` with list `favorites`. "People who saved this car" is now targetable |
| 6 | Scroll about halfway down the home page and leave it alone for 20 seconds | A newsletter card appears **on its own** | An on-site experience fired by behaviour, not by a button. It only shows while nobody knows who they are, and only once per visitor |

---

## Act 2. Research: browsing becomes understanding

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 7 | Open the [X-TRAIL](https://dengage-presales.github.io/nissanksa/vehicles/x-trail/) | Real published SAR prices, real Nissan photography | Nothing on this page is invented |
| 8 | Press **Watch the X-TRAIL price** | It confirms | `wishlist_events` with list `price_drop_alert`. A second audience: people waiting for a price move |
| 9 | Press **Download brochure** | The brochure moment fires | A real event, and a message the visitor gets. Today a brochure download tells marketing nothing |
| 10 | Open the [Pathfinder](https://dengage-presales.github.io/nissanksa/vehicles/pathfinder/) | The page loads, another model view recorded | Two models in one session is the condition the next step needs |
| 11 | Open the [Patrol](https://dengage-presales.github.io/nissanksa/vehicles/patrol/) and **do not touch anything for 20 seconds** | The **test drive invite** appears on its own | Someone who has read three cars and booked nothing is the person worth inviting. The rule found them without anyone pressing a button |
| 12 | Open [Compare](https://dengage-presales.github.io/nissanksa/compare/) and pick two cars | They line up on published figures | A comparison audience: "viewed an X-TRAIL and a Pathfinder in one session" |
| 13 | Open [Find your Nissan](https://dengage-presales.github.io/nissanksa/find-your-nissan/) and answer all three questions | The range narrows, and **TEKTON is named separately as unpriced** | The one number Nissan has not published is left out rather than guessed. The purchase horizon is captured here too |
| 14 | Open [My Showroom](https://dengage-presales.github.io/nissanksa/my-showroom/) | Your saved car, your price watch, everything you viewed, and the line at the top saying nobody knows your name yet | Everything above happened while this person was anonymous. This is the half of the story most CDP demos skip |

---

## Act 3. Offers and finance: the decision starts

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 15 | Open [Offers](https://dengage-presales.github.io/nissanksa/offers/) and wait 9 seconds | The **National Day** offer appears | Their real offers page shows "0 Matching Offers" today. This one is never empty |
| 16 | Stay on the page another 25 seconds | The **seasonal offer** appears | Experiences queue rather than pile up: one on screen at a time, 25 seconds apart, once per session each |
| 17 | Open the [finance calculator](https://dengage-presales.github.io/nissanksa/finance-calculator/), pick a model, change the down payment and the term | The monthly figure recomputes | A finance intent event. Wanting to know the monthly is the strongest pre-purchase signal on the site |
| 18 | Go back to any model page and wait 30 seconds | The **finance teaser** appears | It only fires because the calculator was used. The site is reacting to what this person did, not to who they are |

---

## Act 4. Build a car, and nearly walk away

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 19 | Open [Build and reserve](https://dengage-presales.github.io/nissanksa/configure/?model=x-trail) | Seven X-TRAIL grades with their real prices. **SL 4WD 7 Seats shows no price and no photograph** | Nissan publishes neither for that grade, so the demo shows neither rather than inventing them |
| 20 | Choose a grade | The summary follows your choice | A cart line at that grade's real price |
| 21 | Choose a **different** grade | The summary shows **one car, not two** | The old line is removed before the new one is added. Dengage rebuilds a cart from the event stream, so without this the profile would show someone holding two cars |
| 22 | Move the mouse up out of the window, as if leaving | The **test drive rescue** appears | Someone who chose a trim and is leaving has told the site which car and what they would pay. It is the one exit worth interrupting |
| 23 | Press **Reserve this build**, fill it in, confirm | The build is held, and a message is asked for | The reservation moment: email, notification and the message drawer, all three |

---

## Act 5. The test drive, and the moment they get a name

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 24 | Open [Book a test drive](https://dengage-presales.github.io/nissanksa/book-a-test-drive/?model=x-trail) | Nissan's own form fields, including **Purchase Horizon** | The form is theirs, field for field, not an approximation |
| 25 | Type a name and a phone number, then move the mouse out of the window **without submitting** | The **test drive rescue** appears again | Abandonment is caught only once typing has started. Interrupting someone who has typed nothing is just a popup |
| 26 | Come back, fill it in properly and submit | A confirmation card repeating exactly what you typed: model, name, mobile, email, city, showroom, horizon | Nothing is invented and an empty field is left out. Today the customer hears nothing until a cold call, days later |
| 27 | Look at the readout | `addToCart`, `beginCheckout`, `order`, and the lead row | The whole funnel, in the standard ecommerce tables, exactly as a real store writes it |
| 28 | Open the bell, marked **Nissan KSA updates** | The confirmation is in the drawer | A third channel, instant, alongside the email and the notification |
| 29 | Allow notifications when the card offers it, then book once more | The notification arrives within seconds, **with the car's photograph** | The web push channel, working with no mobile app. The photograph needs the Media field set: see [VERIFY.md](VERIFY.md) |
| 29a | **On an iPhone only:** Share, then Add to Home Screen, then open the demo from that icon before step 29 | The permission prompt appears, which it does not in a Safari tab | iOS delivers a web push only to a site added to the Home Screen. Android needs none of this. The card says so if you press it in a tab |
| 30 | Check the email you used | The confirmation email, with the car's photograph and its published starting price | Two channels answering one action, in seconds |

---

## Act 6. The car that does not exist yet

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 31 | Open the [Tekton](https://dengage-presales.github.io/nissanksa/vehicles/tekton/) and wait 8 seconds | The launch bar appears | The Tekton has no price and no stock, so the only honest thing to offer is a place in the queue |
| 32 | Register interest | The interest is recorded | A launch-day audience, built before the car arrives, with no price invented anywhere |

---

## Act 7. The other ways they raise a hand

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 33 | Open [Request a quote](https://dengage-presales.github.io/nissanksa/request-a-quote/) and press submit with the form empty | It is held for the mandatory fields | The form behaves like the real one. A test that submits an empty form and passes is testing nothing |
| 34 | Fill it in and submit | The quote moment fires, and **no order is written** | A quote is not a booking. The two write different rows and start different journeys |
| 35 | Open [Find a showroom](https://dengage-presales.github.io/nissanksa/find-a-showroom/) | The eight branches | These come from the same CDP table the dealer segments are built on, not from a hard-coded list |
| 36 | Open [Shop@Home](https://dengage-presales.github.io/nissanksa/shop-at-home/) and use each of the three actions | Each one reaches the thing that answers it | Every control on this demo does something. There is no decoration |

---

## Act 8. The offline half, which is the whole argument

The [dealer cockpit](https://dengage-presales.github.io/nissanksa/dealer/) stands
in for a showroom tablet and a partner feed. **The buttons are a simulation of
the source, and nothing else about it is simulated**: the events, the storage,
the profile update and the journey reaction are all genuinely Dengage.

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 37 | Open the cockpit | It says it is acting for the visitor from the website | The person who just booked online is the same person about to walk in. That is the composable CDP moment |
| 38 | Press **Walk-in captured** | The log names what it wrote | A showroom visit lands on the same profile as the browsing. Today it lands on a salesperson's phone |
| 39 | Press **Test drive booked offline**, then **Test drive completed** | Each reports its send | The same-evening follow-up, automatic. Today it depends on whether someone remembers |
| 40 | Press **Test drive no-show** | The re-invite moment | Nobody re-invites a no-show today, because nobody knows there was one |
| 41 | Press **Test drive cancelled** | It reverses the order it names | A cancelled booking is corrected in Dengage, not left standing |
| 42 | Press **Call outcome: call later**, **Quote issued**, **WhatsApp intent signal** | Each writes its own row | The call centre loop and the Value First WhatsApp feed, both landing on one profile. Production is Value First calling the same API |
| 43 | Press **Vehicle sold** | The funnel ends | Sales journeys stop and further sales messages are suppressed. Today nobody tells marketing a car was sold, so the messages keep going |

---

## Act 9. The same demo, as a person Dengage already knows

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 44 | Open <https://dengage-presales.github.io/nissanksa/?ck=DPS-1> | The browser becomes Ahmed from Riyadh | One URL switches between the anonymous story and the known one, mid call |
| 45 | Open My Showroom and the cockpit as DPS-1 | Their history reads back: the Olaya walk-in, and whatever you just did on the site | Web behaviour and showroom history on one card is the thing they cannot do today at all |
| 46 | Keep an anonymous private window open beside it | Two visitors, two separate stories, one site | Anonymous and known are both first class here, not one bolted onto the other |

---

## Act 10. In the Dengage panel

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 47 | Open the contact card for the key this browser minted, or for DPS-1 | The page views, the cart, the order, the wishlist rows and the showroom history | One profile, both sides of the business |
| 48 | Open the segments | Hot leads **72**, no-shows **12**, open quotes **43** (32 of them over 14 days), upgrade audience **228**, dealer leads **216** across 8 branches, merged contacts **508**, and **214** on the stock view of whom **40 want a car their own branch does not have** | Real counts on real remote tables, not a mock-up. The last one is a segment nobody at Nissan can see today |
| 49 | Press **Read again** on the console tab you opened at the start | Every one of the seven tables has moved | The proof. An HTTP 200 means accepted; a row means stored |

---

## Act 11. The two switches worth knowing before a call

| # | Do this | You should see | What it proves |
|---|---|---|---|
| 50 | Add `?onsite=panel` to any demo page | The demo's own experiences stand down, and each launcher card names the campaign it fires from Dengage | The same experience served by the on-site engine rather than drawn by the site. `?onsite=local` switches back |
| 51 | Press the floating **Dengage demo** button | The launcher: the ten Nissan experiences, thirteen shared on-site formats, five inline slots, push and app inbox | Anything above that did not happen naturally can be fired on demand, twice in a row, without going dark |

---

## The same run, automated

Everything in Acts 1 to 8 that a machine can press is also a script, so the
whole thing can be checked before a call in four minutes instead of forty:

    python3 -m http.server 8101
    node tools/rehearse-nissan.mjs --from google --term "nissan x-trail price"

Thirty one steps against the live account, reporting what Dengage actually
answered for each moment. Add `--email you@example.com` to rehearse the email
half as well; without an address it sends none, because a rehearsal that
invents one sends real mail to a domain that does not exist.

It cannot rehearse a notification arriving: push needs a service worker and a
permission grant, and a headless browser has neither, so **"this contact has no
device bound" is the correct answer there** rather than a fault. It is exactly
what a real anonymous visitor gets before they say yes to notifications. Steps
29 and 30 above are the ones only a person can do.
