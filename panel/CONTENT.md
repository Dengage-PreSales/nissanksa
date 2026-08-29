# Composer sheet: every journey message, field by field

Push, SMS and inbox content is built in Dengage's own composer under the
Marketing tab, never as HTML. This sheet mirrors the composer's fields, so
building a content is filling each labeled line into the matching input.
Field names follow dev.dengage.com's content guides. Suggested content
names match the D.auto naming already used in the campaign folder.

The copy is deliberately model neutral because a journey fires for
whichever car the person chose; production inserts name and model through
the composer's Customization tool. The one deliberately specific message
is the published X-TRAIL installment offer. All of it is pre-purchase.

---

## Web push (Content > Push, platform Web)

### 1. Booking confirmed, the "seconds later" moment
| Field | Value |
|---|---|
| Content Name | D.auto - Push - Booking confirmed |
| Title | Your test drive is booked |
| Message | Your test drive request is in. The branch will call to set the exact time. See you soon. |
| Target URL | https://dengage-presales.github.io/nissanksa/ |
| Icon | Default |

### 2. Abandoned booking rescue
| Field | Value |
|---|---|
| Content Name | D.auto - Push - Booking rescue |
| Title | One step left |
| Message | Your test drive was almost booked. Finishing takes under a minute. |
| Target URL | https://dengage-presales.github.io/nissanksa/book-a-test-drive/ |
| Icon | Default |

### 3. Welcome
| Field | Value |
|---|---|
| Content Name | D.auto - Push - Welcome |
| Title | Welcome to Nissan KSA |
| Message | You are set. New offers and arrivals will reach you here first. |
| Target URL | https://dengage-presales.github.io/nissanksa/ |
| Icon | Default |

### 4. No-show re-invite
| Field | Value |
|---|---|
| Content Name | D.auto - Push - No-show re-invite |
| Title | Your drive is still waiting |
| Message | That time did not work out, no problem. Pick any new time and the keys will be ready. |
| Target URL | https://dengage-presales.github.io/nissanksa/book-a-test-drive/ |
| Icon | Default |

### 5. Post test drive, same evening
| Field | Value |
|---|---|
| Content Name | D.auto - Push - Post drive quote |
| Title | How did it feel? |
| Message | The car you drove today can be yours. Your quote is one tap away. |
| Target URL | https://dengage-presales.github.io/nissanksa/request-a-quote/ |
| Icon | Default |

### 6. Win-back after quiet days
| Field | Value |
|---|---|
| Content Name | D.auto - Push - Win-back |
| Title | Still thinking it over? |
| Message | The car you were looking at is still here. Come take another look. |
| Target URL | https://dengage-presales.github.io/nissanksa/ |
| Icon | Default |

### 7. TEKTON launch day (this journey is TEKTON specific)
| Field | Value |
|---|---|
| Content Name | D.auto - Push - TEKTON launch |
| Title | TEKTON has landed |
| Message | You asked to be first. Book your look at the all-new TEKTON today. |
| Target URL | https://dengage-presales.github.io/nissanksa/vehicles/tekton/ |
| Media, optional | https://dengage-presales.github.io/nissanksa/assets/img/side-tekton.jpg |
| Icon | Default |

## SMS (Content > SMS)

Sender Name comes from the account's dropdown; if the account holds no
sender id, the run of show talks over these rather than sending. Each body
stays inside one segment and carries the STOP opt-out.

### 8. Booking confirmed
| Field | Value |
|---|---|
| Content Name | D.auto - SMS - Booking confirmed |
| Sender Name | account dropdown |
| Message | Nissan KSA: your test drive request is in. The branch will call to confirm the time. Reply STOP to opt out. |

### 9. Hot lead same-day follow-up
| Field | Value |
|---|---|
| Content Name | D.auto - SMS - Hot lead follow-up |
| Sender Name | account dropdown |
| Message | Nissan KSA: thanks for your interest. A product specialist will call you today to arrange everything. Reply STOP to opt out. |

### 10. Quote follow-up
| Field | Value |
|---|---|
| Content Name | D.auto - SMS - Quote follow-up |
| Sender Name | account dropdown |
| Message | Nissan KSA: your quote is ready at the branch. Questions? Call 920009058. Reply STOP to opt out. |

## Inbox (the storefront drawer reads these)

### 11. Welcome card
| Field | Value |
|---|---|
| Content Name | D.auto - Inbox - Welcome |
| Title | Your Nissan inbox |
| Message | Offers, arrivals and booking updates collect here, so nothing gets lost. |
| Target URL | https://dengage-presales.github.io/nissanksa/ |

### 12. Offer card, the deliberately specific one
| Field | Value |
|---|---|
| Content Name | D.auto - Inbox - X-TRAIL 999 |
| Title | X-TRAIL from SAR 999 monthly |
| Message | The published installment campaign, with 0% admin fees and 0% down payment. See the offer page for conditions. |
| Target URL | https://dengage-presales.github.io/nissanksa/offers/x-trail-999/ |
| Media, optional | https://dengage-presales.github.io/nissanksa/assets/img/side-x-trail.jpg |

## Email subjects (bodies are composer work, later phase unless time allows)

| Content Name | Subject |
|---|---|
| D.auto - Email - Booking confirmed | Your Nissan test drive is booked |
| D.auto - Email - Rescue | One step left on your test drive |
| D.auto - Email - Brochure follow-up | Your Nissan brochure, and what to read first |

## WhatsApp (Value First's channel, not the Dengage composer)

Copy handed to Value First for their WABA; shown on the journey canvas.

- **Intent follow-up**: Hi! You asked about financing options. A specialist
  can walk you through the plans, or book you straight into a test drive.
  What suits you better?
- **Booking handoff**: Your test drive is confirmed. Share your location
  when you set out and the branch will have everything ready.
