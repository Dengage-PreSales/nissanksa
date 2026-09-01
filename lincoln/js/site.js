/* ============================================================================
   The Lincoln storefront's own behavior layer.

   Unlike the Nissan replica, this capture keeps the source site's original
   JavaScript alive, so menus, carousels and field validation are the site's
   own. This module adds only what the demo needs on top:

     the funnel        model picked                 ->  ec:addToCart
                       details entered              ->  ec:beginCheckout
                       the booking is submitted     ->  ec:order, plus the
                                                        test_drive_booked lead
     typed details    every lead form also posts what was typed to the lead
                      relay, which upserts the contact server side
     interception     the source forms post to /leads/submit on the real
                      dealer's backend; a capture phase listener stops that
                      cold, so nothing this demo does ever reaches Naghi

   Event emission stays in js/dengageEvents.js alone; this file only calls it.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var slug = window.DEMO_SLUG || 'lincoln';
    var TD_KEY = 'dps:' + slug + ':td';
    var CAMPAIGN_KEY = 'dps:' + slug + ':campaign';
    var LEAD_KEY = 'dps:' + slug + ':lead';

    function readJson(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }
    function writeJson(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }

    function t(key, vars) {
        return (window.SiteCopy && window.SiteCopy.t) ? window.SiteCopy.t(key, vars) : key;
    }

    /* ------------------------------------------------------------------ */
    /* Overlays: the launcher, inbox drawer and event panel                */

    function openOverlay(sel) {
        closeOverlays();
        var el = $(sel);
        if (el) el.classList.add('open');
    }
    function closeOverlays() {
        $$('.dps-drawer.open, .dps-modal.open').forEach(function (el) { el.classList.remove('open'); });
    }
    function wireOverlays() {
        document.addEventListener('click', function (event) {
            var opener = event.target.closest ? event.target.closest('[data-open]') : null;
            if (opener) {
                event.preventDefault();
                openOverlay(opener.getAttribute('data-open'));
                return;
            }
            var closer = event.target.closest ? event.target.closest('[data-close]') : null;
            if (closer) { event.preventDefault(); closeOverlays(); return; }
            if (event.target.id === 'scrim') closeOverlays();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeOverlays();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Funnel state                                                        */

    function pending() { return readJson(TD_KEY, null); }
    function setPending(line) {
        if (line) writeJson(TD_KEY, line);
        else try { window.localStorage.removeItem(TD_KEY); } catch (err) { /* noop */ }
    }
    function cartLines() {
        var line = pending();
        return line ? [line] : [];
    }

    function mintIdentity() {
        var identity = window.DemoIdentity;
        if (identity && !identity.contactKey && typeof identity.mintKey === 'function') {
            var key = identity.mintKey(Date.now());
            if (window.DengageEvents.setContactKey(key)) {
                identity.contactKey = key;
                try { window.sessionStorage.setItem(identity.storageKey, key); } catch (err) { /* noop */ }
            }
        }
    }

    /* The source forms gate submission on a privacy consent checkbox; its
       state is the truth the consent flag records. A form without one is a
       direct request to be contacted. */
    function consentGiven(form) {
        var box = form.querySelector('input[name="privacyconsent"], input[name="allOptIn"]');
        return box ? !!box.checked : true;
    }

    /* The typed details' path onto the contact card. The Web SDK deliberately
       cannot write contact fields from a page, so each lead form also posts
       what was typed to the lead relay, the demo's stand-in for a website
       backend, which upserts the contact server side through the Dengage REST
       API. Fire and forget: the SDK events never depend on it, and a missing
       relay costs only the server side copy. panel/README.md section 1a. */
    function relayLead(form, fields) {
        var url = (window.DEMO_CONFIG || {}).leadRelay;
        if (!url || typeof window.fetch !== 'function') return;
        function val(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            if (!v || /^select/i.test(v)) return undefined;
            return v;
        }
        var camp = campaign();
        var body = {
            contact_key: (window.DemoIdentity || {}).contactKey,
            name: val('firstname'),
            surname: val('lastname'),
            email: val('email'),
            gsm: val('mobile'),
            city: val('city'),
            page_url: window.location.href,
            utm_source: camp.utm_source,
            utm_medium: camp.utm_medium,
            utm_campaign: camp.utm_campaign,
            marketing_consent: consentGiven(form)
        };
        for (var k in fields) { if (fields[k] !== undefined) body[k] = fields[k]; }
        try {
            return window.fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            })['catch'](function () { /* the lead's SDK trail is unaffected */ });
        } catch (err) { /* no fetch, no relay */ }
        return null;
    }

    /* The campaign that brought them, kept for as long as the browser keeps
       anything. It used to be read from the address bar at the moment a form
       was submitted, so a visitor who arrived on an advertisement and then
       clicked through to the booking page reached it with a clean address and
       the one thing a dealer most wants to know about a paid lead was the one
       thing never sent. First touch wins: a later direct visit must not erase
       which advertisement bought the lead. */
    function rememberCampaign() {
        var params;
        try { params = new URLSearchParams(window.location.search); } catch (err) { return; }
        var source = params.get('utm_source');
        if (!source && params.get('fbclid')) source = 'facebook';
        if (!source && params.get('gclid')) source = 'google';
        if (!source) return;
        if (readJson(CAMPAIGN_KEY, null)) return;
        writeJson(CAMPAIGN_KEY, {
            utm_source: source,
            utm_medium: params.get('utm_medium') || undefined,
            utm_campaign: params.get('utm_campaign') || undefined
        });
    }
    function campaign() { return readJson(CAMPAIGN_KEY, null) || {}; }

    /* What the visitor gave us, kept on this device so the rest of the demo can
       address them. The dealer cockpit reads it: a walk in logged for someone
       who booked on this browser earns an email as well as a notification,
       which is the difference between a moment that lands and one that depends
       on notifications having been allowed. It never leaves the browser except
       in the messages this visitor asked for. */
    function rememberLead(details) {
        if (!details || !details.email) return;
        writeJson(LEAD_KEY, {
            name: details.name, surname: details.surname,
            email: details.email, gsm: details.gsm, city: details.city
        });
    }

    function recalledLead() {
        var held = readJson(LEAD_KEY, null) || {};
        return { name: held.name, surname: held.surname, email: held.email,
                 gsm: held.gsm, city: held.city };
    }

    /* A form a known visitor has already filled in once should not ask again.
       The browser holds what they typed, so every later lead form starts
       filled and they correct rather than retype. It is also the honest
       demonstration of a known contact: the site behaves as if it knows them,
       because it does. */
    function prefillFromLead() {
        var held = recalledLead();
        if (!held.email) return;
        var fields = { firstname: held.name, lastname: held.surname,
                       email: held.email, mobile: held.gsm, city: held.city };
        Object.keys(fields).forEach(function (name) {
            if (!fields[name]) return;
            var el = document.querySelector('[name="' + name + '"]');
            if (!el || el.value) return;
            if (el.tagName === 'SELECT') {
                Array.prototype.forEach.call(el.options, function (opt) {
                    if (opt.value === fields[name] || opt.textContent.trim() === fields[name]) {
                        el.value = opt.value;
                    }
                });
            } else {
                el.value = fields[name];
            }
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    /* Run something when a promise settles or when the wait is up, whichever
       comes first, and only ever once. */
    function once(promise, ms, fn) {
        var done = false;
        function go() {
            if (done) return;
            done = true;
            fn();
        }
        if (promise && promise.then) promise.then(go, go);
        window.setTimeout(go, ms);
    }

    /* The confirmation a booking earns. It runs after the relay has answered,
       because the contact has to exist before Dengage can address a push to
       it. The messages themselves are panel content; this only asks for them,
       and a refusal costs the booking nothing. */
    function confirmBooking(details, moment) {
        var url = (window.DEMO_CONFIG || {}).bookingConfirm;
        if (!url || typeof window.fetch !== 'function') return;
        /* The token this device holds, sent so a push can still reach it if the
           contact key has not been bound to a subscription yet. The server
           addresses the contact first and only falls back to this. */
        var token = window.DengageEvents.deviceToken();
        var body = {
            moment: moment || 'booking',
            contact_key: (window.DemoIdentity || {}).contactKey,
            name: details.name, surname: details.surname,
            email: details.email, gsm: details.gsm,
            model: details.model, model_id: details.model_id,
            booking_ref: details.booking_ref,
            city: details.city, branch: details.branch,
            purchase_horizon: details.horizon
        };
        try {
            if (token) body.device_token = token;
            window.fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            }).then(function (res) { return res.json(); })
              .then(function (answer) {
                  try {
                      document.dispatchEvent(new CustomEvent('dps:lincoln:confirmation',
                          { detail: answer }));
                  } catch (err) { /* old browser */ }
              })['catch'](function () { /* the booking is already recorded */ });
        } catch (err) { /* no fetch */ }
    }

    /* What the visitor has done, for the creative rules in js/creatives.js.
       Session scoped: a new session starts the story again. */
    function signal(name, value) {
        try { window.sessionStorage.setItem('dps:' + slug + ':' + name, JSON.stringify(value)); }
        catch (err) { /* private mode */ }
    }
    /* Read one back. It has to come from the same store signal writes to:
       reading these from localStorage looks right and always answers false,
       which is how the abandonment guard below came to let a booking through. */
    function signalled(name) {
        try {
            var raw = window.sessionStorage.getItem('dps:' + slug + ':' + name);
            return raw ? JSON.parse(raw) : false;
        } catch (err) { return false; }
    }

    /* ------------------------------------------------------------------ */
    /* Mandatory fields: the demo owns validation the moment it owns submit */

    function firstMissingRequired(form) {
        var fields = $$('[required], [aria-required="true"]', form);
        for (var i = 0; i < fields.length; i++) {
            var el = fields[i];
            if (el.offsetParent === null && el.type !== 'hidden') continue;
            if (el.type === 'hidden') continue;
            if (el.type === 'checkbox' && !el.checked) return el;
            if (el.checkValidity && !el.checkValidity()) return el;
            if (!el.value || /^select/i.test(el.value)) return el;
        }
        return null;
    }
    function demandRequired(form) {
        var missing = firstMissingRequired(form);
        if (!missing) return false;
        if (missing.reportValidity) missing.reportValidity();
        else missing.focus();
        return true;
    }

    function success(form, message) {
        var note = document.createElement('div');
        note.className = 'dps-form-done';
        note.textContent = message;
        form.replaceWith(note);
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function toast(message) {
        var note = $('#dps-toast');
        if (!note) {
            note = document.createElement('div');
            note.id = 'dps-toast';
            document.body.appendChild(note);
        }
        note.textContent = message;
        note.classList.add('show');
        window.setTimeout(function () { note.classList.remove('show'); }, 2600);
    }

    /* ------------------------------------------------------------------ */
    /* The lead forms. One capture phase listener owns every submit so the
       source site's own AJAX (posting to the dealer's real backend) never
       runs, and each page's form feeds the funnel it belongs to.           */

    function harvest(form) {
        function pick(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            if (!v || /^select/i.test(v)) return undefined;
            return v;
        }
        var modelName = pick('model');
        return {
            car: modelName ? window.Catalog.get(modelName.toLowerCase()) : null,
            city: pick('city'),
            branch: pick('branch'),
            plan: pick('purchaseplan'),
            payment: pick('paymenttype')
        };
    }

    var lastPickId = null;
    function pickCar(car) {
        if (!car || car.id === lastPickId) return;
        lastPickId = car.id;
        var line = { id: car.id, quantity: 1, price: car.price };
        setPending(line);
        window.DengageEvents.addToCart(line, cartLines());
        sendBeginCheckout();
    }

    /* THE DETAILS STEP NAMES THE CAR, or it does not go out at all.

       beginCheckout used to fire on the first keystroke with whatever had
       been picked so far, which for anyone who typed their name before
       touching the model select was nothing: an ec:beginCheckout carrying an
       empty cart. Seen in a live run on 1 September 2026. That row is the
       abandoned booking, and one that names no car is a row no segment can
       target and no rescue journey can personalize, which is the whole
       reason the event is sent.

       So the two conditions are held separately and the event waits for
       both: the visitor has started entering their details, and a car is
       known. Whichever happens second sends it, exactly once. */
    var detailsStarted = false;
    var checkoutSent = false;
    function sendBeginCheckout() {
        if (!detailsStarted || checkoutSent) return;
        var line = pending();
        if (!line) return;
        checkoutSent = true;
        window.DengageEvents.beginCheckout([line]);
    }

    function wireFunnelSignals() {
        var modelSelect = $('form[action*="leads/submit"] select[name="model"]');
        if (modelSelect) {
            var params = null;
            try { params = new URLSearchParams(window.location.search); } catch (err) { /* old browser */ }
            var preset = params && (params.get('model') || params.get('vehicle'));
            if (preset) {
                $$('option', modelSelect).forEach(function (o) {
                    if (o.value.toLowerCase() === preset.toLowerCase()) modelSelect.value = o.value;
                });
                var car0 = window.Catalog.get((modelSelect.value || '').toLowerCase());
                if (car0) pickCar(car0);
            }
            modelSelect.addEventListener('change', function () {
                /* A browser autofill preview can flip this select and revert
                   a moment later; only a choice still standing counts. */
                window.setTimeout(function () {
                    var car = window.Catalog.get((modelSelect.value || '').toLowerCase());
                    if (car) pickCar(car);
                }, 150);
            });
        }

        if (window.location.pathname.indexOf('forms/testdrive') !== -1) {
            document.addEventListener('input', function (e) {
                if (detailsStarted) return;
                var name = e.target && e.target.name;
                if (name === 'firstname' || name === 'lastname' || name === 'email' || name === 'mobile') {
                    detailsStarted = true;
                    signal('started', true);
                    /* A car already standing in the select was never picked
                       up, because pickCar only ever ran on a change event. */
                    var form = e.target.form || $('form[action*="leads/submit"]');
                    if (form) pickCar(harvest(form).car);
                    sendBeginCheckout();
                }
            });
        }

        /* Choosing finance anywhere is the signal the finance card waits for. */
        document.addEventListener('change', function (e) {
            if (e.target && e.target.name === 'paymenttype' && /finance/i.test(e.target.value || '')) {
                signal('finance', true);
            }
        });
    }

    function submitBooking(form) {
        var f = harvest(form);
        if (!f.car) {
            toast('Choose a model first.');
            var sel = form.querySelector('select[name="model"]');
            if (sel) sel.focus();
            return;
        }
        if (demandRequired(form)) return;
        mintIdentity();
        var relayed = relayLead(form, { form: 'booking', model: f.car.id, purchase_horizon: f.plan });
        var line = pending() || { id: f.car.id, quantity: 1, price: f.car.price };
        var bookingRef = 'DPS-' + slug + '-td-' + Date.now();
        window.DengageEvents.order({
            orderId: bookingRef,
            itemCount: 1,
            paymentMethod: 'other'
        }, [line]);
        window.DengageEvents.leadEvent('test_drive_booked', {
            model: f.car.id, city: f.city, branch: f.branch,
            purchase_horizon: f.plan, source: 'website'
        });
        if (f.payment === 'Finance') {
            window.DengageEvents.leadEvent('finance_intent', { model: f.car.id, source: 'website' });
        }
        setPending(null);
        signal('booked', true);
        success(form, t('tdThanks'));

        /* The on-site confirmation repeats back what was typed, and the relay
           has already been asked for the confirmation email and push. */
        function typed(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            return (!v || /^select/i.test(v)) ? undefined : v;
        }
        var summary = {
            model: f.car.name,
            model_id: f.car.id,
            booking_ref: bookingRef,
            name: typed('firstname'),
            surname: typed('lastname'),
            gsm: typed('mobile'),
            email: typed('email'),
            city: f.city,
            branch: f.branch,
            horizon: f.plan,
            payment: f.payment
        };
        if (window.LincolnCreatives) window.LincolnCreatives.confirm(summary);
        /* The confirmation follows the relay, because the contact has to exist
           before Dengage can address a push to it. It does not wait forever:
           a relay that is slow, or that never answers on a poor connection,
           must not cost the visitor their confirmation. The message function
           is happy either way, since it only reads a contact that the relay
           has usually already created. */
        rememberLead(summary);
        once(relayed, 2500, function () { confirmBooking(summary); });
    }

    function submitQuote(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'quote', model: f.car ? f.car.id : undefined, purchase_horizon: f.plan });
        /* Through pickCar, so choosing the car and then submitting does not
           write the same product into the cart twice, three seconds apart. */
        pickCar(f.car);
        window.DengageEvents.leadEvent('quote_issued', {
            model: f.car ? f.car.id : undefined, city: f.city, branch: f.branch,
            purchase_horizon: f.plan, source: 'website', note: 'online quote request'
        });
        function typedIn(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            return (!v || /^select/i.test(v)) ? undefined : v;
        }
        confirmBooking({
            model: f.car ? f.car.name : undefined,
            model_id: f.car ? f.car.id : undefined,
            name: typedIn('firstname'), surname: typedIn('lastname'),
            gsm: typedIn('mobile'), email: typedIn('email'),
            city: f.city, branch: f.branch, horizon: f.plan
        }, 'quote');
        if (f.payment === 'Finance') {
            window.DengageEvents.leadEvent('finance_intent', { model: f.car ? f.car.id : undefined, source: 'website' });
        }
        success(form, 'Your quote request is in. It is on your profile, and the follow-up journey takes it from here.');
    }

    function submitBrochure(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'register_interest', model: f.car ? f.car.id : undefined });
        window.DengageEvents.leadEvent('brochure', {
            model: f.car ? f.car.id : undefined, source: 'website'
        });
        success(form, 'Noted. The specification documents on this page are yours to open, and your interest is on your profile.');
    }

    function submitContact(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'register_interest', model: f.car ? f.car.id : undefined });
        window.DengageEvents.leadEvent('register_interest', {
            model: f.car ? f.car.id : undefined, city: f.city, source: 'website', note: 'contact form'
        });
        success(form, 'Thank you. Your message is on your profile and our team will be in touch.');
    }

    function isLeadForm(form) {
        if (!form || !form.getAttribute) return false;
        var action = form.getAttribute('action') || '';
        return action.indexOf('leads/submit') !== -1 || !!form.querySelector('[name="endpointPath"]');
    }

    function routeLead(form) {
        var path = window.location.pathname;
        if (path.indexOf('forms/testdrive') !== -1) return submitBooking(form);
        if (path.indexOf('forms/quote') !== -1) return submitQuote(form);
        if (path.indexOf('download-specifications') !== -1) return submitBrochure(form);
        return submitContact(form);
    }

    function interceptLeadForms() {
        /* The source bundle binds its own click handler to the submit button
           and calls form.submit() from it. That DOM method posts the form
           without ever raising a submit event, so a submit listener alone
           never sees a real click: the browser leaves for the dealer's lead
           endpoint, which this demo does not host. The click is therefore
           taken first, in the capture phase, before their handler runs. */
        document.addEventListener('click', function (event) {
            var el = event.target;
            var control = el && el.closest ? el.closest('button, input[type="submit"], input[type="image"]') : null;
            if (!control) return;
            if (control.type === 'button' && !control.classList.contains('formSubmitBtn')) return;
            var form = control.form || (control.closest ? control.closest('form') : null);
            if (!isLeadForm(form)) return;
            event.preventDefault();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            routeLead(form);
        }, true);

        /* Pressing Enter in a field submits without any click, and that path
           does raise the event. */
        document.addEventListener('submit', function (event) {
            if (!isLeadForm(event.target)) return;
            event.preventDefault();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            routeLead(event.target);
        }, true);

        $$('form[action*="leads/submit"]').forEach(function (form) {
            /* The source markup validates through its own library; the demo
               owns submit, so it owns the mandatory field check too. */
            form.setAttribute('novalidate', '');
            /* Last line of defence: whatever calls submit() on a lead form,
               now or after a capture is refreshed, is answered by the demo
               rather than by a page navigation. */
            try {
                form.submit = function () { routeLead(form); };
            } catch (e) { /* a form with a field named submit cannot be patched */ }
        });
    }

    /* The specification sheets are plain document links rather than a form,
       so the interest they show is recorded from the download itself. The
       document still opens: the visitor gets what they clicked. */
    function trackBrochureDownloads() {
        var sent = {};
        document.addEventListener('click', function (event) {
            var a = event.target.closest ? event.target.closest('a[href$=".pdf"]') : null;
            if (!a) return;
            var href = a.getAttribute('href') || '';
            if (sent[href]) return;
            sent[href] = true;
            var name = href.split('/').pop().toLowerCase();
            var car = null;
            (window.Catalog ? window.Catalog.all() : []).forEach(function (c) {
                if (name.indexOf(c.id) !== -1) car = c;
            });
            window.DengageEvents.leadEvent('brochure', {
                model: car ? car.id : undefined, source: 'website'
            });
            if ((window.DemoIdentity || {}).contactKey) {
                /* Whatever this visitor already told us, so the message can
               reach them by email as well as by notification. Without it the
               specification message could only ever be a push, and a visitor
               who has not allowed notifications got nothing at all. */
            var known = recalledLead();
            known.model = car ? car.name : undefined;
            known.model_id = car ? car.id : undefined;
            confirmBooking(known, 'brochure');
            }
        });
    }

    /* The booking begun and left behind. It fires once, only from the booking
       page, only when the visitor typed an address to reach them at, and never
       after the booking went through: an abandonment message to someone who
       already booked is the thing that makes brands look careless. */
    function watchAbandonedBooking() {
        if (window.location.pathname.indexOf('forms/testdrive') === -1) return;
        var asked = false;
        function ask() {
            if (asked) return;
            var form = $('form[action*="leads/submit"]');
            if (!form || signalled('booked')) return;
            var email = form.querySelector('[name="email"]');
            var address = email && email.value ? email.value.trim() : '';
            if (!address || address.indexOf('@') === -1) return;
            asked = true;
            var sel = form.querySelector('select[name="model"]');
            var car = sel && sel.value ? window.Catalog.get(sel.value.toLowerCase()) : null;
            mintIdentity();
            /* Whatever they had already typed travels with it, so the message
               can name the city and the timing they had chosen rather than
               starting the conversation over. A field still blank is left out
               and its line simply does not print. */
            var field = function (name) {
                var el = form.querySelector('[name="' + name + '"]');
                return el && el.value ? el.value.trim() : undefined;
            };
            confirmBooking({
                model: car ? car.name : undefined,
                model_id: car ? car.id : undefined,
                name: field('firstname'),
                surname: field('lastname'),
                gsm: field('mobile'),
                city: field('city'),
                horizon: field('purchaseplan'),
                email: address
            }, 'abandoned_booking');
        }
        document.addEventListener('mouseout', function (event) {
            if (event.relatedTarget || event.clientY > 8) return;
            ask();
        });
        window.addEventListener('pagehide', ask);
    }

    /* Ownership and service journeys are a later phase; any link that
       survived generation is answered honestly rather than left dead. */
    function guardScope() {
        document.addEventListener('click', function (event) {
            var a = event.target.closest ? event.target.closest('a[href*="/owners"]') : null;
            if (a) { event.preventDefault(); toast(t('postSale')); }
        });
    }

    /* ------------------------------------------------------------------ */
    /* The shared popup creatives ask the host page for its theme. Answer
       with Lincoln's, read from the site's own stylesheet palette.        */

    var THEME = {
        primary: '#324047', onPrimary: '#ffffff', accent: '#b45f1a',
        ink: '#1c1f21', muted: '#4f4c43', surface: '#ffffff', page: '#f5f4f2',
        line: '#dcdcd8', tint: '#f0efec', radius: '2px',
        brandText: '#324047', shadow: '0 12px 32px rgba(20,26,30,.22)',
        displayFont: '"ProximaNova", "Segoe UI", Arial, sans-serif',
        bodyFont: '"ProximaNova", "Segoe UI", Arial, sans-serif'
    };
    function answerThemeRequests() {
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.dnTheme !== 'request') return;
            if (!event.source) return;
            try { event.source.postMessage({ dnTheme: 'reply', theme: THEME }, '*'); }
            catch (err) { /* a frame that has already gone is not an error */ }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */

    function pageviewDetail() {
        var body = document.body;
        return {
            productId: body.getAttribute('data-product-id') || undefined,
            price: body.getAttribute('data-price') || undefined,
            categoryPath: body.getAttribute('data-category-path') || undefined,
            promotionId: body.getAttribute('data-promotion-id') || undefined
        };
    }

    function hideBrokenImages() {
        document.addEventListener('error', function (event) {
            var el = event.target;
            if (el && el.tagName === 'IMG') el.style.visibility = 'hidden';
        }, true);
        $$('img').forEach(function (img) {
            var src = img.getAttribute('src') || '';
            if (/\.svg(\?|$)/i.test(src)) return;
            if (img.complete && img.naturalWidth === 0 && src) {
                img.style.visibility = 'hidden';
            }
        });
    }

    function boot() {
        /* Before the page view, because the campaign that brought them is on
           the address of this very page and will not be there on the next one. */
        rememberCampaign();
        prefillFromLead();

        /* FIRST, before anything else on the page: the page view is the only
           thing that makes this demo's rows findable in the shared tables. */
        window.DengageEvents.pageview(
            document.body.getAttribute('data-page-type') || 'other', pageviewDetail());

        /* Claim this device for the contact we are browsing as. Passing the key
           to initialize names the visitor on the events, but it does not move
           an existing push subscription: Dengage binds a token to a contact
           when a subscription is posted, so a device that subscribed under an
           earlier key stays with that key until this call re-posts it. Without
           it, ?ck=DPS-1 shows the right name on screen while a push addressed
           to DPS-1 finds no device. */
        var claimed = (window.DemoIdentity || {}).contactKey;
        if (claimed) window.DengageEvents.setContactKey(claimed);

        if (window.Panels) window.Panels.init();
        if (window.Slots) window.Slots.init();
        if (window.Inbox) window.Inbox.boot();
    }

    window.Storefront = {
        t: t,
        openOverlay: openOverlay,
        closeOverlays: closeOverlays,
        boot: boot
    };
    window.Site = {
        cartLines: cartLines,
        /* The page creatives capture leads too, through this same relay, and
           ask for the booking confirmation again once a push token exists. */
        relayLead: relayLead,
        confirmBooking: confirmBooking,
        saved: function () { return []; },
        toast: toast,
        mintIdentity: mintIdentity
    };

    wireOverlays();
    interceptLeadForms();
    trackBrochureDownloads();
    watchAbandonedBooking();
    wireFunnelSignals();
    guardScope();
    answerThemeRequests();
    hideBrokenImages();

    function bootOnce() {
        if (window.__dpsBooted) return;
        window.__dpsBooted = true;
        boot();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootOnce);
    } else {
        bootOnce();
    }
})(window, document);
