/* ============================================================================
   The dealer cockpit: a tablet-style simulator for the offline half of the
   pre-purchase story. Nothing here is a mock of Dengage. Every button writes
   a real event through js/dengageEvents.js into the real platform; what is
   simulated is only the SOURCE, the showroom tablet, the call-center screen
   or the Value First webhook that would send the same signal in production.
   The page says so on its face.

   Choosing a persona identifies this browser as that DPS- contact, exactly
   as a presenter typing the key would, so every signal lands on the same
   contact card the seeded offline dataset already describes.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

    /* The eight seeded personas. The same eight rows, with the same stories,
       are in supabase/seed.sql; change them together. */
    var PERSONAS = [
        { key: 'DPS-1', name: 'Ahmed', city: 'Riyadh',  note: 'Walked into Olaya showroom, X-TRAIL quote pending, 3 web sessions' },
        { key: 'DPS-2', name: 'Sara',  city: 'Jeddah',  note: 'Asked the WhatsApp bot about PATROL financing' },
        { key: 'DPS-3', name: 'Mohammed', city: 'Riyadh', note: 'Booked a test drive, then never came' },
        { key: 'DPS-4', name: 'Noura', city: 'Dammam',  note: 'Drives a 2019 ALTIMA, browsing the new one' },
        { key: 'DPS-5', name: 'Khalid', city: 'Riyadh', note: 'Buying within a month, eyes on PATROL PRO-4X' },
        { key: 'DPS-6', name: 'Fatima', city: 'Makkah', note: 'Downloaded the KICKS brochure, used the finance calculator' },
        { key: 'DPS-7', name: 'Omar',  city: 'Khobar',  note: 'Test drive completed yesterday, X-TERRA' },
        { key: 'DPS-8', name: 'Layla', city: 'Jeddah',  note: 'On the TEKTON waiting list' }
    ];

    /* The persona's home showroom, matching the Find a Showroom directory
       and the seeded ni_branch table. */
    var HOME_BRANCH = {
        Riyadh: 'Olaya Showroom, Riyadh',
        Jeddah: 'Madinah Road Showroom, Jeddah',
        Dammam: 'King Fahd Road Showroom, Dammam',
        Khobar: 'Khobar Showroom, Khobar',
        Makkah: 'Makkah Showroom, Makkah'
    };

    /* Every signal names the real mechanics it uses, on the button itself.
       A branch of 'home' resolves to the chosen persona's own showroom. */
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

    var state = { persona: null, model: 'x-trail' };

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
            /* Three of these are moments the customer hears about. The rest
               change who they are without saying anything, which is what stops
               the wrong message going out later. */
            if (spec.moment) messageFor(spec.moment, state.persona, car);
            log('Sent ' + spec.id + ' for ' + state.persona, row);
        });
    }

    /* What the visitor told the website, if this browser is that visitor. The
       seeded personas carry a name and a city here in the page; someone who
       arrived through the storefront carries what they typed into a form, and
       an address is the difference between a follow-up they can read and a
       notification they may never have allowed. */
    function ownLead() {
        try {
            var raw = window.localStorage.getItem('dps:' + window.DEMO_SLUG + ':lead');
            return raw ? JSON.parse(raw) : null;
        } catch (err) { return null; }
    }

    function messageFor(moment, personaKey, car) {
        var url = (window.DEMO_CONFIG || {}).bookingConfirm;
        if (!url || typeof window.fetch !== 'function') return;
        var persona = PERSONAS.filter(function (p) { return p.key === personaKey; })[0];
        /* A key that is not one of the seeded eight is a real visitor who came
           in through the website, and is the whole point of the offline half:
           they book online, then walk into a showroom. Whoever it is gets the
           message, with the details we have and without the ones we do not. */
        var own = (window.DemoIdentity || {}).contactKey === personaKey ? ownLead() : null;
        var body = {
            brand: 'nissan',
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
        /* Only when this browser IS the persona: then its own token is a fair
           fallback if Dengage has not bound the key to a subscription yet.
           Firing a signal for someone else must never push to this machine. */
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
                  /* The same announcement the storefront makes, so ?debug=1
                     shows a cockpit send exactly as it shows a website one.
                     Without it the three offline buttons wrote their signals,
                     sent their messages and left the readout empty, which
                     reads on a call as three buttons that did nothing. */
                  try {
                      document.dispatchEvent(new CustomEvent(
                          'dps:' + (window.DEMO_SLUG || 'demo') + ':confirmation',
                          { detail: answer }));
                  } catch (err) { /* old browser */ }
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
        /* A persona already active in this browser stays active here. */
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
