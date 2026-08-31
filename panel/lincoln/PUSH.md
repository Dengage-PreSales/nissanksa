# The push copy for each moment

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
