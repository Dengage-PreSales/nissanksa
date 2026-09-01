/* ============================================================================
   The dealer cockpit: a tablet-style simulator for the offline half of the
   pre-purchase story. Nothing here is a mock of Dengage. Every button writes
   a real event through js/dengageEvents.js into the real platform; what is
   simulated is only the SOURCE, the showroom tablet, the call-center screen
   or the Value First webhook that would send the same signal in production.
   The page says so on its face.

   Choosing a persona identifies this browser as that DPS- contact, the same
   eight contacts the Nissan demo seeded, because a person is one contact
   however many storefronts they browse; only the model line-up and the
   branch directory here are Lincoln's.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

    var PERSONAS = [
        { key: 'DPS-1', name: 'Ahmed', city: 'Riyadh',  note: 'Navigator quote pending, 3 web sessions this week' },
        { key: 'DPS-2', name: 'Sara',  city: 'Jeddah',  note: 'Asked the WhatsApp bot about Aviator financing' },
        { key: 'DPS-3', name: 'Mohammed', city: 'Riyadh', note: 'Booked a test drive, then never came' },
        { key: 'DPS-4', name: 'Noura', city: 'Dammam',  note: 'Browsing the Corsair range pages' },
        { key: 'DPS-5', name: 'Khalid', city: 'Riyadh', note: 'Buying within a month, eyes on the Navigator' },
        { key: 'DPS-6', name: 'Fatima', city: 'Makkah', note: 'Downloaded the Aviator specifications' },
        { key: 'DPS-7', name: 'Omar',  city: 'Khobar',  note: 'Test drive completed yesterday, Corsair' },
        { key: 'DPS-8', name: 'Layla', city: 'Jeddah',  note: 'Quote requested online, awaiting the call' }
    ];

    /* The persona's nearest showroom from the dealer's real branch list.
       Cities outside the network carry no branch, and an absent branch is
       omitted from the row rather than invented. */
    var HOME_BRANCH = {
        Jeddah: 'Jeddah - Madinah Road',
        Makkah: 'Mecca - Al Kakiyyah Branch'
    };

    var SIGNALS = [
        { id: 'walk_in',           label: 'Walk-in captured',        detail: 'Reception logs a visitor at the showroom',            lead: { source: 'showroom', branch: 'home' }, moment: 'showroom_visit' },
        { id: 'test_drive_booked', label: 'Test drive booked offline', detail: 'Booked at the desk or over the phone',              lead: { source: 'showroom', branch: 'home' }, order: true },
        { id: 'test_drive_done',   label: 'Test drive completed',    detail: 'The keys came back, the follow-up can start',         lead: { source: 'showroom' }, moment: 'test_drive_done' },
        { id: 'no_show',           label: 'Test drive no-show',      detail: 'Booked, never came; the re-invite journey reacts',    lead: { source: 'showroom' }, moment: 'no_show' },
        { id: 'call_outcome',      label: 'Call outcome: call later', detail: 'The call center logs the answer instead of closing', lead: { source: 'call-center', note: 'call later' } },
        { id: 'quote_issued',      label: 'Quote issued',            detail: 'A dealer quote enters the follow-up journey',         lead: { source: 'showroom', branch: 'home' } },
        { id: 'whatsapp_intent',   label: 'WhatsApp intent signal',  detail: 'Simulates the Value First chatbot calling Dengage',   lead: { source: 'value-first-whatsapp', note: 'asked about financing' } },
        { id: 'vehicle_sold',      label: 'Vehicle sold',            detail: 'Ends the funnel: sales journeys stop for this buyer', lead: { source: 'showroom', branch: 'home' } }
    ];

    var state = { persona: null, model: 'navigator' };

    function log(message, detail) {
        var pane = $('#ck-log');
        if (!pane) return;
        var time = new Date().toTimeString().slice(0, 8);
        pane.textContent = time + '  ' + message +
            (detail ? '\n' + JSON.stringify(detail, null, 2) : '') +
            '\n\n' + pane.textContent;
    }

    function renderPersonas() {
        var host = $('#ck-personas');
        host.innerHTML = PERSONAS.map(function (p) {
            return '<button type="button" class="ck-persona" data-key="' + p.key + '">' +
                '<b>' + p.key + '</b><span>' + p.name + ' · ' + p.city + '</span>' +
                '<i>' + p.note + '</i></button>';
        }).join('');
        host.addEventListener('click', function (e) {
            var btn = e.target.closest('.ck-persona');
            if (!btn) return;
            var key = btn.getAttribute('data-key');
            if (window.DengageEvents.setContactKey(key)) {
                state.persona = key;
                try { window.sessionStorage.setItem('dps:' + window.DEMO_SLUG + ':ck', key); } catch (err) { /* noop */ }
                $$('.ck-persona').forEach(function (b) { b.classList.toggle('active', b === btn); });
                log('This tablet now acts for ' + key + '. Every signal lands on that contact card.');
            }
        });
    }

    function renderModels() {
        var sel = $('#ck-model');
        sel.innerHTML = window.Catalog.all().map(function (c) {
            return '<option value="' + c.id + '"' + (c.id === state.model ? ' selected' : '') + '>' + c.nameEn + '</option>';
        }).join('');
        sel.addEventListener('change', function () { state.model = sel.value; });
    }

    function renderSignals() {
        var host = $('#ck-signals');
        host.innerHTML = SIGNALS.map(function (s) {
            return '<button type="button" class="ck-signal" data-id="' + s.id + '">' +
                '<b>' + s.label + '</b><span>' + s.detail + '</span>' +
                '<i>writes ni_lead_events</i></button>';
        }).join('');
        host.addEventListener('click', function (e) {
            var btn = e.target.closest('.ck-signal');
            if (!btn) return;
            if (!state.persona) {
                log('Choose a persona first: a signal needs a contact to land on.');
                return;
            }
            var spec = SIGNALS.filter(function (s) { return s.id === btn.getAttribute('data-id'); })[0];
            var car = window.Catalog.get(state.model);
            var fields = { model: car ? car.id : undefined, city: cityOf(state.persona) };
            Object.keys(spec.lead).forEach(function (k) { fields[k] = spec.lead[k]; });
            if (fields.branch === 'home') fields.branch = HOME_BRANCH[fields.city];
            var row = window.DengageEvents.leadEvent(spec.id, fields);
            /* An offline booking is still a booking: the same funnel event the
               website sends, so the shared journeys see it identically. */
            if (spec.order && car) {
                window.DengageEvents.order({
                    orderId: 'DPS-' + window.DEMO_SLUG + '-offline-' + Date.now(),
                    itemCount: 1,
                    totalAmount: car.price,
                    paymentMethod: 'other'
                }, [{ id: car.id, quantity: 1, price: car.price }]);
            }
            /* Three of these are moments the customer hears about: the walk in
               that thanks them, the drive that asks how it went, and the
               no-show that offers another time. The message goes out through
               the same transactional endpoint the website uses, addressed to
               this persona. */
            if (spec.moment) messageFor(spec.moment, state.persona, car);
            log('Sent ' + spec.id + ' for ' + state.persona, row);
        });
    }

    /* What the visitor told the website, if this browser is the visitor. The
       seeded personas carry a name and a city here in the page; someone who
       arrived through the storefront carries what they typed into a form, and
       an address is the difference between a follow-up they can read and a
       notification they may never have allowed. */
    function ownLead() {
        try {
            var raw = window.localStorage.getItem('dps:lincoln:lead');
            return raw ? JSON.parse(raw) : null;
        } catch (err) { return null; }
    }

    function messageFor(moment, personaKey, car) {
        var url = (window.DEMO_CONFIG || {}).bookingConfirm;
        if (!url || typeof window.fetch !== 'function') return;
        var persona = PERSONAS.filter(function (p) { return p.key === personaKey; })[0];
        /* A key that is not one of the eight is a real visitor who came in
           through the website, and is the whole point of the offline half:
           they book online, then walk into a showroom. Dropping them here
           wrote the signal, logged that it was sent, and quietly sent nothing.
           Whoever it is now gets the message, with the details we have and
           without the ones we do not. */
        var own = (window.DemoIdentity || {}).contactKey === personaKey ? ownLead() : null;
        var body = {
            moment: moment,
            contact_key: personaKey,
            name: persona ? (persona.name || '').split(' ')[0] : (own ? own.name : undefined),
            surname: own ? own.surname : undefined,
            email: own ? own.email : undefined,
            gsm: own ? own.gsm : undefined,
            city: persona ? persona.city : (own ? own.city : undefined),
            branch: persona ? HOME_BRANCH[persona.city] : undefined,
            model: car ? car.name : undefined,
            model_id: car ? car.id : undefined
        };
        /* Only when this browser IS the persona, which is what ?ck=DPS-1
           arranges: then its own token is a fair fallback if Dengage has not
           bound the key to a subscription yet. Firing a signal for someone
           else must never push to the machine running the cockpit. */
        if ((window.DemoIdentity || {}).contactKey === personaKey) {
            var token = window.DengageEvents.deviceToken();
            if (token) body.device_token = token;
        }
        try {
            window.fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            }).then(function (res) { return res.json(); })
              .then(function (answer) {
                  log('Asked Dengage for the ' + moment + ' message', answer);
              })['catch'](function () { /* the signal itself is already sent */ });
        } catch (err) { /* no fetch */ }
    }

    function cityOf(key) {
        var p = PERSONAS.filter(function (x) { return x.key === key; })[0];
        return p ? p.city : undefined;
    }

    function boot() {
        /* Every page fires the page view first; the cockpit is no exception. */
        window.DengageEvents.pageview('other');
        renderPersonas();
        renderModels();
        renderSignals();
        var identity = window.DemoIdentity;
        if (identity && identity.contactKey) {
            state.persona = identity.contactKey;
            $$('.ck-persona').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-key') === identity.contactKey);
            });
            log('Acting for ' + identity.contactKey + ' (already identified in this browser).');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window, document);
