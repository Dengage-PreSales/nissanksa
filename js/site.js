/* ============================================================================
   The site layer of the replica: navigation, overlays, the booking funnel and
   page boot. It exposes the surface the ported modules consume:
   window.Storefront { t, openOverlay, closeOverlays, boot } and
   window.Site { cartLines }.

   THE FUNNEL IS THE AUTOMOTIVE MAPPING, and it runs on the site's own booking
   form rather than a modal, because the source site has a real one:

     choose a model on the form   ->  ec:addToCart
     details entered              ->  ec:beginCheckout   (abandon here and the
                                      abandoned basket journey becomes an
                                      abandoned test drive rescue)
     the booking is submitted     ->  ec:order, with the car's real displayed
                                      price and payment_method 'other', plus
                                      one ni_lead_events row carrying what the
                                      standard tables have no column for: the
                                      purchase horizon, the model and the city.

   Every event still flows through js/dengageEvents.js alone; this file only
   decides when to call it.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var slug = window.DEMO_SLUG || 'nissanksa';
    var TD_KEY = 'dps:' + slug + ':tdcart';
    var CAMPAIGN_KEY = 'dps:' + slug + ':campaign';
    var LEAD_KEY = 'dps:' + slug + ':lead';
    var WISH_KEY = 'dps:' + slug + ':wishlist';

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

    function readJson(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : fallback;
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (err) { return fallback; }
    }
    function writeJson(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }

    function t(key, vars) {
        return window.SiteCopy ? window.SiteCopy.t(key, vars) : key;
    }

    /* ------------------------------------------------------------------ */
    /* Overlays: one scrim, drawers and modals toggled with .open           */

    function openOverlay(sel) {
        var el = $(sel);
        if (!el) return;
        closeOverlays();
        el.classList.add('open');
        var scrim = $('#scrim');
        if (scrim) scrim.classList.add('open');
        document.documentElement.classList.add('dps-locked');
    }

    function closeOverlays() {
        $$('.dps-drawer.open, .dps-modal.open').forEach(function (el) { el.classList.remove('open'); });
        var scrim = $('#scrim');
        if (scrim) scrim.classList.remove('open');
        document.documentElement.classList.remove('dps-locked');
        document.querySelectorAll('header.c_010D.dps-menu-open').forEach(function (h) {
            h.classList.remove('dps-menu-open');
        });
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
        else { try { window.localStorage.removeItem(TD_KEY); } catch (err) { /* noop */ } }
    }
    function cartLines() {
        var line = pending();
        return line ? [line] : [];
    }

    function wishlist() { return readJson(WISH_KEY, []); }
    function isSaved(id) { return wishlist().indexOf(id) !== -1; }
    function toggleSaved(id) {
        var list = wishlist();
        var at = list.indexOf(id);
        var car = window.Catalog.get(id);
        if (!car) return false;
        if (at === -1) {
            list.push(id);
            window.DengageEvents.addToWishlist({ id: car.id, price: car.price }, 'favorites');
        } else {
            list.splice(at, 1);
            window.DengageEvents.removeFromWishlist({ id: car.id }, 'favorites');
        }
        writeJson(WISH_KEY, list);
        return at === -1;
    }

    function paintHearts() {
        $$('[data-save-car]').forEach(function (el) {
            el.classList.toggle('saved', isSaved(el.getAttribute('data-save-car')));
        });
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
            return el && el.value ? el.value : undefined;
        }
        var consent = form.querySelector('input[name="allOptIn"]');
        var titleValue = val('Title');
        if (titleValue && /select/i.test(titleValue)) titleValue = undefined;
        var body = {
            contact_key: (window.DemoIdentity || {}).contactKey,
            title: titleValue,
            name: val('FirstName'),
            surname: val('LastName'),
            email: val('Email'),
            gsm: val('Phone'),
            page_url: window.location.href,
            utm_source: campaign().utm_source,
            utm_medium: campaign().utm_medium,
            utm_campaign: campaign().utm_campaign,
            marketing_consent: consent ? !!consent.checked : false
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

    /* What the visitor typed, read off whichever lead form they used. */
    function leadDetails(form) {
        function val(name) {
            var el = form && form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            if (!v || /^select/i.test(v)) return undefined;
            return v;
        }
        return {
            name: val('FirstName'), surname: val('LastName'),
            email: val('Email'), gsm: val('Phone'), city: val('City')
        };
    }

    /* Kept on this device so the rest of the demo can address them. The dealer
       cockpit reads it: a walk in logged for someone who booked on this browser
       earns an email as well as a notification, which is the difference between
       a moment that lands and one that depends on notifications having been
       allowed. It never leaves the browser except in the messages this visitor
       asked for. */
    function rememberLead(details) {
        if (!details || !details.email) return;
        writeJson(LEAD_KEY, {
            name: details.name, surname: details.surname,
            email: details.email, gsm: details.gsm, city: details.city
        });
    }

    /* What the visitor has done, for the creative rules in js/creatives.js.
       Session scoped: a new session starts the story again. */
    function signal(name, value) {
        try { window.sessionStorage.setItem('dps:' + slug + ':' + name, JSON.stringify(value)); }
        catch (err) { /* private mode */ }
    }
    /* Read one back. It has to come from the same store signal writes to:
       reading these from localStorage looks right and always answers false. */
    function signalled(name) {
        try {
            var raw = window.sessionStorage.getItem('dps:' + slug + ':' + name);
            return raw ? JSON.parse(raw) : false;
        } catch (err) { return false; }
    }

    /* THE BOOKING THAT WAS LEFT HALF DONE.

       Asked for once per page, and only when the visitor has given an address
       to answer: a rescue message with nowhere to go is not a rescue. What
       they had already typed travels with it, so the message names the car and
       the city they had chosen rather than starting over. A field still blank
       is left out and its line simply does not print. */
    var askedAbandon = false;
    function abandonedBooking() {
        if (askedAbandon) return false;
        /* The booking form specifically, which wireBookingForm marks. Taking
           the first form on the page instead found the header search and read
           an empty address out of it, so the rescue never fired. */
        var form = null;
        var forms = document.querySelectorAll('form');
        for (var i = 0; i < forms.length; i++) {
            if (forms[i].__dpsBooking) { form = forms[i]; break; }
        }
        if (!form) return false;
        var lead = leadDetails(form);
        if (!lead.email || lead.email.indexOf('@') === -1) return false;
        if (signalled('booked')) return false;
        askedAbandon = true;
        mintIdentity();
        var line = pending();
        var car = line && window.Catalog ? window.Catalog.get(line.id) : null;
        confirmBooking({
            model: car ? car.name : undefined,
            model_id: car ? car.id : undefined,
            name: lead.name, surname: lead.surname, gsm: lead.gsm,
            email: lead.email, city: lead.city
        }, 'abandoned_booking');
        return true;
    }

    /* The messages a moment earns, asked for through Dengage's transactional
       API. The content lives in the panel; this only names the moment and who
       it is for, and a refusal costs the lead nothing because the relay has
       already stored it. */
    function confirmBooking(details, moment) {
        var url = (window.DEMO_CONFIG || {}).bookingConfirm;
        if (!url || typeof window.fetch !== 'function') return;
        var token = window.DengageEvents.deviceToken();
        var body = {
            brand: 'nissan',
            moment: moment || 'booking',
            contact_key: (window.DemoIdentity || {}).contactKey,
            name: details.name, surname: details.surname,
            email: details.email, gsm: details.gsm,
            model: details.model, model_id: details.model_id,
            city: details.city, branch: details.branch,
            purchase_horizon: details.horizon
        };
        if (token) body.device_token = token;
        try {
            window.fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            }).then(function (res) { return res.json(); })
              .then(function (answer) {
                  try {
                      document.dispatchEvent(new CustomEvent('dps:' + slug + ':confirmation',
                          { detail: answer }));
                  } catch (err) { /* older browser, no CustomEvent constructor */ }
              })['catch'](function () { /* the lead is already stored */ });
        } catch (err) { /* no fetch */ }
    }

    /* ------------------------------------------------------------------ */
    /* The hero and every other frozen slick carousel                       */

    function wireCarousels() {
        $$('.slick-slider').forEach(function (root) {
            if (root.__dpsCarousel) return;
            var track = $('.slick-track', root);
            if (!track) return;
            var slides = $$('.slick-slide', track).filter(function (s) {
                return !s.classList.contains('slick-cloned');
            });
            if (slides.length < 2) return;
            track.style.transform = 'none';
            track.style.width = 'auto';
            track.style.display = 'block';
            track.style.position = 'relative';
            slides.forEach(function (s, i) {
                s.style.width = '100%';
                s.style.float = 'none';
                s.style.position = i === 0 ? 'relative' : 'absolute';
                s.style.inset = i === 0 ? '' : '0';
            });
            $$('.slick-cloned', track).forEach(function (c) { c.style.display = 'none'; });
            var scope = root.closest('section') || root.parentElement || root;
            var dots = $$('.slick-dots li', scope);
            var at = 0, timer = null;
            function show(next) {
                at = (next + slides.length) % slides.length;
                slides.forEach(function (s, i) {
                    s.style.opacity = i === at ? '1' : '0';
                    s.style.zIndex = i === at ? '2' : '1';
                    s.style.pointerEvents = i === at ? 'auto' : 'none';
                    s.style.transition = 'opacity .6s ease';
                });
                dots.forEach(function (d, i) {
                    d.classList.toggle('slick-active', i === at);
                });
            }
            function auto() {
                if (timer) window.clearInterval(timer);
                timer = window.setInterval(function () { show(at + 1); }, 6500);
            }
            dots.forEach(function (d, i) {
                d.style.cursor = 'pointer';
                d.setAttribute('data-dps-wired', '1');
                d.addEventListener('click', function (e) { e.preventDefault(); show(i); auto(); });
            });
            root.__dpsCarousel = {
                next: function () { show(at + 1); auto(); },
                prev: function () { show(at - 1); auto(); }
            };
            $$('button', scope).forEach(function (b) {
                var al = (b.getAttribute('aria-label') || '') + ' ' + (b.className || '');
                if (/slick-prev|previous/i.test(al)) {
                    b.setAttribute('data-dps-wired', '1');
                    b.addEventListener('click', function (e) { e.preventDefault(); root.__dpsCarousel.prev(); });
                } else if (/slick-next|next/i.test(al)) {
                    b.setAttribute('data-dps-wired', '1');
                    b.addEventListener('click', function (e) { e.preventDefault(); root.__dpsCarousel.next(); });
                }
            });
            var swipe = null;
            root.addEventListener('pointerdown', function (e) { swipe = e.clientX; });
            root.addEventListener('pointerup', function (e) {
                if (swipe === null) return;
                var dx = e.clientX - swipe;
                swipe = null;
                if (Math.abs(dx) < 40) return;
                if (dx < 0) { show(at + 1); } else { show(at - 1); }
                auto();
            });
            show(0); auto();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Header: burger, meganav, search                                      */

    function wireHeader() {
        var header = $('header.c_010D');
        if (!header) return;

        var burger = $('.burger', header);
        if (burger) {
            burger.setAttribute('data-dps-wired', '1');
            burger.addEventListener('click', function (e) {
                e.preventDefault();
                header.classList.toggle('dps-menu-open');
            });
        }
        var overlay = $('.c_010D-overlay', header);
        if (overlay) {
            overlay.addEventListener('click', function () {
                header.classList.remove('dps-menu-open');
            });
        }

        /* The header's own top links arrive as script toggles; each one
           now answers for itself. */
        $$('a[href^="javascript"], a:not([href])', header).forEach(function (a) {
            if (a.__dps) return;
            var label = (a.textContent || '').trim().toUpperCase();
            var act = null;
            if (label.indexOf('VEHICLES') === 0) {
                act = function () { header.classList.toggle('dps-menu-open'); };
            } else if (label.indexOf('SHOP@HOME') === 0) {
                act = function () { window.location.href = sitePrefix() + 'shop-at-home/index.html'; };
            } else if (label.indexOf('OWNERS') === 0 || label.indexOf('OWNE') === 0) {
                act = function () { toast(t('postSale')); };
            } else if (label.indexOf('WHY NISSAN') === 0) {
                act = function () { window.location.href = sitePrefix() + 'index.html#models'; };
            } else if (label === 'ENGLISH') {
                act = function () { toast('This demonstration is in English; the Arabic mirror is a later phase.'); };
            } else if (label.indexOf('OPEN MENU') === 0) {
                return; /* the burger, wired above */
            } else {
                act = function () { toast(t('notPart')); };
            }
            a.__dps = true;
            a.setAttribute('data-dps-wired', '1');
            a.addEventListener('click', function (e) { e.preventDefault(); act(); });
        });

        /* The meganav's category rail switches its vehicle panels. */
        var cats = $$('.c_010D-meganav .categories > li', header);
        var panels = $$('.c_010D-meganav .vehicles-container', header);
        cats.forEach(function (li, i) {
            li.style.cursor = 'pointer';
            li.setAttribute('data-dps-wired', '1');
            li.addEventListener('click', function (e) {
                var a = li.querySelector('a');
                var label = (a ? a.textContent : li.textContent).trim().toUpperCase();
                if (/PERFECT|COMPARE/.test(label)) {
                    /* The matchmaker and comparison tools are scripted upstream;
                       the model grid is this demo's answer to both. */
                    e.preventDefault();
                    window.location.href = sitePrefix() + 'index.html#models';
                    return;
                }
                if (a && a.getAttribute('href') && a.getAttribute('href').indexOf('javascript') === -1) return;
                e.preventDefault();
                cats.forEach(function (x, j) { x.classList.toggle('active', j === i); });
                panels.forEach(function (p, j) { p.classList.toggle('active', j === Math.min(i, panels.length - 1)); });
            });
        });

        /* The search box answers in place with a real search event. */
        $$('form[data-demo-search]', document).forEach(function (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var input = form.querySelector('input');
                var q = input ? input.value.trim() : '';
                if (!q) return;
                var hits = window.Catalog.search(q);
                window.DengageEvents.search(q, hits.length);
                toast(hits.length
                    ? hits.length + ' model(s) match "' + q + '"'
                    : 'No model matches "' + q + '"');
                if (hits.length === 1 && hits[0].pdp) {
                    window.location.href = sitePrefix() + 'vehicles/' + hits[0].path + '/index.html';
                } else {
                    var grid = $('.vehiclelisting');
                    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    else window.location.href = sitePrefix() + 'index.html#models';
                }
                header.classList.remove('dps-menu-open');
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Forms: the booking funnel on the site's own pages                    */

    function currentModelId() {
        return document.body.getAttribute('data-product-id') || null;
    }

    function modelFromName(name) {
        var hit = null;
        window.Catalog.all().forEach(function (c) {
            if (hit) return;
            if (c.nameEn.toUpperCase() === String(name || '').trim().toUpperCase()) hit = c;
        });
        return hit;
    }

    /* The demo owns validation, because the source forms carry required
       flags on stripped and invisible fields that would block the submit
       silently. This walks only the fields a person can actually see and
       returns the first empty mandatory one. */
    function firstMissingRequired(form) {
        var fields = form.querySelectorAll('input[required], select[required], textarea[required], [aria-required="true"]');
        for (var i = 0; i < fields.length; i++) {
            var el = fields[i];
            if (el.disabled || el.type === 'hidden') continue;
            var box = el.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            var empty = el.type === 'checkbox' ? !el.checked : !(el.value || '').trim();
            if (empty || (el.checkValidity && !el.checkValidity())) return el;
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

    function wireBookingForm() {
        var modelSelect = $('select[name="Model"]');
        var form = modelSelect ? modelSelect.closest('form') : null;
        if (!form) return;
        /* The quote form carries a Model select too; the model machinery
           below serves both pages, but the order and booking lead belong
           to the booking page alone. The quote submit stays with
           wireOtherLeadForms. */
        var isBooking = window.location.pathname.indexOf('book-a-test-drive') !== -1;
        if (isBooking) form.__dpsBooking = true;
        form.setAttribute('novalidate', '');

        var begun = false;
        /* The source form's option values are internal ids; the model name
           lives in the option text and its data-name attribute. */
        function optionName(option) {
            return (option.getAttribute('data-name') || option.textContent || '').trim();
        }
        function chosen() {
            var option = modelSelect.selectedOptions && modelSelect.selectedOptions[0];
            if (!option || !option.value) return null;
            return modelFromName(optionName(option));
        }

        var lastPickId = null;
        function pick(car) {
            if (!car || car.id === lastPickId) return;
            lastPickId = car.id;
            var line = { id: car.id, quantity: 1, price: car.price };
            setPending(line);
            window.DengageEvents.addToCart(line, cartLines());
            sendBeginCheckout();
        }

        /* THE DETAILS STEP NAMES THE CAR, or it does not go out at all.

           beginCheckout used to fire on the first keystroke, falling back to
           a line built from whatever the select held, which for a visitor who
           types their name before choosing a model is a cart item whose id
           and price are both undefined. That row is the abandoned booking,
           and one that names no car is a row no segment can target and no
           rescue journey can personalize, which is the whole reason it is
           sent. So the event waits for both conditions, details started and a
           car known, and whichever happens second sends it, exactly once. */
        var checkoutSent = false;
        function sendBeginCheckout() {
            if (!begun || checkoutSent) return;
            var line = pending();
            if (!line) return;
            checkoutSent = true;
            window.DengageEvents.beginCheckout([line]);
        }

        /* Arriving from a model page's own Book button preselects that car
           and records the pick, exactly as the click promised. The demo's
           links carry the catalogue id in model; the source site's captured
           buttons carry its internal id in c020_model, and the option
           values ARE those internal ids. */
        var params = null;
        try { params = new URLSearchParams(window.location.search); } catch (err) { /* old browser */ }
        if (params) {
            var preset = params.get('model');
            var car0 = preset ? window.Catalog.get(preset) : null;
            if (car0) {
                $$('option', modelSelect).forEach(function (o) {
                    if (optionName(o).toUpperCase() === car0.nameEn.toUpperCase()) modelSelect.value = o.value;
                });
            } else if (params.get('c020_model')) {
                modelSelect.value = params.get('c020_model');
            }
            if (chosen()) pick(chosen());
            else modelSelect.selectedIndex = 0;
        }

        modelSelect.addEventListener('change', function () {
            /* A browser autofill preview can flip this select and revert a
               moment later; only a choice still standing counts as a pick. */
            window.setTimeout(function () { pick(chosen()); }, 150);
        });

        if (!isBooking) return;

        form.addEventListener('input', function (e) {
            var name = e.target && e.target.name;
            if (begun) return;
            if (name === 'FirstName' || name === 'LastName' || name === 'Phone' || name === 'Email') {
                begun = true;
                signal('started', true);
                /* A car already standing in the select was never picked up,
                   because pick only ever ran on a change event. */
                pick(chosen());
                sendBeginCheckout();
            }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var car = chosen();
            if (!car) {
                toast('Choose a model first.');
                modelSelect.focus();
                return;
            }
            if (demandRequired(form)) return;
            var city = ($('select[name="City"]') || {}).value || undefined;
            var horizon = ($('select[name="purchaseOutlook"]') || {}).value || undefined;
            if (city && /select/i.test(city)) city = undefined;
            if (horizon && /select/i.test(horizon)) horizon = undefined;
            mintIdentity();
            var relayed = relayLead(form, { form: 'booking', model: car.id, city: city, purchase_horizon: horizon });
            var summary = leadDetails(form);
            summary.model = car.name; summary.model_id = car.id;
            summary.city = city || summary.city; summary.horizon = horizon;
            rememberLead(summary);
            /* The confirmation follows the relay, because the contact has to
               exist before Dengage can address a push to it, but it does not
               wait forever: a slow connection must not cost the visitor their
               email and their notification. */
            once(relayed, 2500, function () { confirmBooking(summary); });
            var line = pending() || { id: car.id, quantity: 1, price: car.price };
            window.DengageEvents.order({
                orderId: 'DPS-' + slug + '-td-' + Date.now(),
                itemCount: 1,
                totalAmount: car.price,
                paymentMethod: 'other'
            }, [line]);
            signal('booked', true);
            window.DengageEvents.leadEvent('test_drive_booked', {
                model: car.id,
                city: city,
                purchase_horizon: horizon,
                source: 'website'
            });
            setPending(null);
            success(form, t('tdThanks'));
        });
    }

    /* The quote and register-interest forms follow the same shape: model in,
       identified contact and a typed lead row out. */
    function wireOtherLeadForms() {
        $$('form').forEach(function (form) {
            if (form.__dpsBooking || form.hasAttribute('data-demo-search')) return;
            if (form.closest('#dengage-panel, #inbox, #site-menu')) return;
            var page = document.body.getAttribute('data-page-type');
            var product = currentModelId();
            if (form.querySelector('[required], [aria-required="true"]')) form.setAttribute('novalidate', '');
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (demandRequired(form)) return;
                var modelSel = form.querySelector('select[name="Model"]');
                var opt = modelSel && modelSel.selectedOptions && modelSel.selectedOptions[0];
                var car = opt && opt.value
                    ? modelFromName((opt.getAttribute('data-name') || opt.textContent || '').trim())
                    : (product ? window.Catalog.get(product) : null);
                var horizonSel = form.querySelector('select[name="purchaseOutlook"]');
                var horizon = horizonSel ? horizonSel.value : undefined;
                if (horizon && /select/i.test(horizon)) horizon = undefined;
                var citySel = form.querySelector('select[name="City"]');
                var city = citySel ? citySel.value : undefined;
                if (city && /select/i.test(city)) city = undefined;
                mintIdentity();
                if (window.location.pathname.indexOf('request-a-quote') !== -1) {
                    var quoteRelay = relayLead(form, { form: 'quote', model: car ? car.id : undefined, city: city, purchase_horizon: horizon });
                    var quoteLead = leadDetails(form);
                    quoteLead.model = car ? car.name : undefined;
                    quoteLead.model_id = car ? car.id : undefined;
                    quoteLead.city = city || quoteLead.city; quoteLead.horizon = horizon;
                    rememberLead(quoteLead);
                    once(quoteRelay, 2500, function () { confirmBooking(quoteLead, 'quote'); });
                    if (car) window.DengageEvents.addToCart({ id: car.id, quantity: 1, price: car.price }, cartLines());
                    window.DengageEvents.leadEvent('quote_issued', {
                        model: car ? car.id : undefined, city: city, purchase_horizon: horizon,
                        source: 'website', note: 'online quote request'
                    });
                    success(form, 'Your quote request is in. It is on your profile, and the follow-up journey takes it from here.');
                    return;
                }
                if (product === 'tekton' || window.location.pathname.indexOf('tekton') !== -1) {
                    var tektonRelay = relayLead(form, { form: 'register_interest', model: 'tekton', city: city });
                    var tektonLead = leadDetails(form);
                    tektonLead.model = 'Tekton'; tektonLead.model_id = 'tekton';
                    tektonLead.city = city || tektonLead.city;
                    rememberLead(tektonLead);
                    once(tektonRelay, 2500, function () { confirmBooking(tektonLead, 'newsletter'); });
                    window.DengageEvents.leadEvent('register_interest', {
                        model: 'tekton', city: city, source: 'website'
                    });
                    success(form, 'You are on the TEKTON list. You will be among the first to know.');
                    return;
                }
                /* The campaign pages' own register-interest forms. */
                var promo = document.body.getAttribute('data-promotion-id');
                if (promo) {
                    if (!car) {
                        window.Catalog.all().forEach(function (c) {
                            if (!car && promo.indexOf(c.id) === 0) car = c;
                        });
                    }
                    var promoRelay = relayLead(form, { form: 'register_interest', model: car ? car.id : undefined, city: city, purchase_horizon: horizon });
                    var promoLead = leadDetails(form);
                    promoLead.model = car ? car.name : undefined;
                    promoLead.model_id = car ? car.id : undefined;
                    promoLead.city = city || promoLead.city; promoLead.horizon = horizon;
                    rememberLead(promoLead);
                    once(promoRelay, 2500, function () { confirmBooking(promoLead, 'newsletter'); });
                    window.DengageEvents.leadEvent('register_interest', {
                        model: car ? car.id : undefined, city: city, purchase_horizon: horizon,
                        source: 'website', note: 'offer ' + promo
                    });
                    success(form, 'You are in. This offer now lives on your profile, and the follow-up reaches you before it ends.');
                    return;
                }
                toast('Thank you. You are now an identified contact in this demo.');
            });
        });
    }

    function success(form, message) {
        var note = document.createElement('div');
        note.className = 'dps-form-done';
        note.textContent = message;
        form.replaceWith(note);
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* ------------------------------------------------------------------ */
    /* CTAs across the site                                                 */

    function sitePrefix() {
        var stamped = document.documentElement.getAttribute('data-rel-root');
        if (stamped !== null) return stamped;
        return window.location.pathname.replace(/[^/]*$/, '');
    }

    function wireCtas() {
        var pre = sitePrefix();
        var product = currentModelId();

        /* A model page's Book a Test Drive carries its car to the form. */
        if (product && product !== 'tekton') {
            $$('a[href]').forEach(function (a) {
                if (/book-a-test-drive\/index\.html$/.test(a.getAttribute('href') || '')) {
                    a.setAttribute('href', a.getAttribute('href') + '?model=' + product);
                }
            });
        }

        /* Brochure controls record the interest they represent. */
        $$('a, button').forEach(function (el) {
            var label = (el.textContent || '').trim();
            if (!/^download( a)? brochure$/i.test(label)) return;
            if (el.__dps) return;
            el.__dps = true;
            el.setAttribute('data-dps-wired', '1');
            el.addEventListener('click', function (e) {
                e.preventDefault();
                var car = null;
                var scope = el.closest('[data-save-car], .vehiclelisting li, article, section, main') || document;
                var heart = scope.querySelector ? scope.querySelector('[data-save-car]') : null;
                if (heart) car = window.Catalog.get(heart.getAttribute('data-save-car'));
                var node = el.parentElement;
                while (!car && node && node !== document.body) {
                    var explore = node.querySelector && node.querySelector('a[href*="vehicles/"]');
                    if (explore) {
                        var m = (explore.getAttribute('href') || '').match(/vehicles\/([a-z0-9-]+)\//);
                        if (m) car = window.Catalog.get(m[1]);
                    }
                    node = node.parentElement;
                }
                if (!car && product) car = window.Catalog.get(product);
                mintIdentity();
                window.DengageEvents.leadEvent('brochure', {
                    model: car ? car.id : undefined, source: 'website'
                });
                confirmBooking({
                    model: car ? car.name : undefined,
                    model_id: car ? car.id : undefined
                }, 'brochure');
                toast(t('brochureSaved', { model: car ? car.name : 'Nissan' }));
            });
        });

        /* Save hearts. */
        document.addEventListener('click', function (event) {
            var heart = event.target.closest ? event.target.closest('[data-save-car]') : null;
            if (heart) {
                event.preventDefault();
                event.stopPropagation();
                toggleSaved(heart.getAttribute('data-save-car'));
                paintHearts();
            }
        });

        /* Ownership links stay visible and answer with the demo's scope. */
        document.addEventListener('click', function (event) {
            var dead = event.target.closest ? event.target.closest('[data-demo-dead]') : null;
            if (!dead) return;
            event.preventDefault();
            var kind = dead.getAttribute('data-demo-dead');
            if (kind === 'whatsapp') {
                toast(t('waNote'));
                return;
            }
            toast(kind === 'postsale' ? t('postSale') : t('notPart'));
        });
    }

    /* ------------------------------------------------------------------ */
    /* Everything else that looks pressable answers for itself. The
       contract: no control on screen is a dead placeholder. Labelled CTAs
       route to their real destination; a control whose feature cannot exist
       in a static demo either explains itself or leaves. */

    function nearestHref(el) {
        var n = el, hops = 0;
        while (n && n !== document.body && hops < 4) {
            if (n.tagName === 'A' && n.getAttribute('href') && n.getAttribute('href') !== '#') return n;
            var a2 = n.querySelector && n.querySelector('a[href]:not([href^="#"]):not([href^="javascript"])');
            if (a2 && a2 !== el) return a2;
            n = n.parentElement; hops += 1;
        }
        return null;
    }

    function wireLabelledCtas() {
        var pre = sitePrefix();
        var product = currentModelId();
        var modelParam = product && product !== 'tekton' ? '?model=' + product : '';
        function go(url) { return function () { window.location.href = url; }; }
        function scrollToGrades() {
            var head = $$('h1,h2,h3,h4').filter(function (h) {
                return /find your|grades|versions|prices/i.test(h.textContent);
            })[0] || $('#dn_inline_target_pdp_below_price');
            if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var CTA = [
            [/^(book a test drive|book my .*test drive)$/i, go(pre + 'book-a-test-drive/index.html' + modelParam)],
            [/^(get an online quote|request a quote)$/i, go(pre + 'request-a-quote/index.html')],
            [/^(reserve now|reserve online|buy online|shop@home)$/i, go(pre + 'shop-at-home/index.html')],
            [/^(prices & specs|prices and specs|compare grades|trim details|view specs and prices)$/i, scrollToGrades],
            [/^(build your .*|configure your .*|configure)$/i, go(pre + 'book-a-test-drive/index.html' + modelParam)],
            [/^(find a showroom|find a nissan center|find a dealer|get directions)$/i, go(pre + 'find-a-showroom/index.html')],
            [/^(explore offers|view all offers|see the offers?)$/i, go(pre + 'offers/index.html')],
            [/^(finance calculator|discover more)$/i, go(pre + 'finance-calculator/index.html')],
            [/^(compare models( & grades)?|find your perfect nissan|start now|view all|explore more)$/i, go(pre + 'index.html#models')],
            [/^(register interest|keep me informed|notify me)$/i, go(pre + 'vehicles/tekton/index.html')],
            [/^(call center|call us|920009058)$/i, go('tel:920009058')]
        ];
        $$('main button, main [role="button"], body > div button').forEach(function (b) {
            if (b.__dps || b.closest('#dengage-panel, #inbox, #test-drive, .dps-controls, #dps-debug, form')) return;
            var label = (b.textContent || '').trim();
            var aria = (b.getAttribute('aria-label') || '').trim();
            for (var i = 0; i < CTA.length; i += 1) {
                if (CTA[i][0].test(label) || CTA[i][0].test(aria)) {
                    b.__dps = true;
                    b.setAttribute('data-dps-wired', '1');
                    var act = CTA[i][1];
                    b.addEventListener('click', function (e) { e.preventDefault(); act(); });
                    return;
                }
            }
        });
    }

    /* Every model page gets a price watch: the SDK's own price_drop_alert
       wishlist list, so "tell me when the price moves" is a real, targetable
       audience the moment someone presses it. */
    function wirePriceWatch() {
        var product = currentModelId();
        if (!product || product === 'tekton' || document.body.getAttribute('data-page-type') !== 'product') return;
        var car = window.Catalog.get(product);
        if (!car || !car.price) return;
        var WATCH_KEY = 'dps:' + slug + ':pricewatch';
        function watched() { return readJson(WATCH_KEY, []); }
        function isWatched() { return watched().indexOf(car.id) !== -1; }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dps-price-watch';
        btn.setAttribute('data-dps-wired', '1');
        function paint() {
            btn.innerHTML = isWatched()
                ? '<b>Watching the ' + car.nameEn + ' price</b><span>You will hear the moment it moves. Press to stop.</span>'
                : '<b>Watch the ' + car.nameEn + ' price</b><span>One press, and a price move reaches you first.</span>';
            btn.classList.toggle('on', isWatched());
        }
        btn.addEventListener('click', function () {
            var list = watched();
            var at = list.indexOf(car.id);
            if (at === -1) {
                list.push(car.id);
                mintIdentity();
                window.DengageEvents.addToWishlist({ id: car.id, price: car.price }, 'price_drop_alert');
                toast('Price watch on. A drop on the ' + car.nameEn + ' reaches you first.');
            } else {
                list.splice(at, 1);
                window.DengageEvents.removeFromWishlist({ id: car.id }, 'price_drop_alert');
                toast('Price watch off.');
            }
            writeJson(WATCH_KEY, list);
            paint();
        });
        paint();
        /* It stands beside the page's own next-step band, or rides above the
           footer when a page has none. */
        var band = $$('h1,h2,h3').filter(function (h) {
            return /take the next step/i.test(h.textContent);
        })[0];
        var host = document.createElement('div');
        host.className = 'dps-price-watch-host';
        host.appendChild(btn);
        if (band && band.parentElement) {
            band.parentElement.insertBefore(host, band.nextSibling);
        } else {
            var slot = $('#dn_inline_target_above_footer');
            if (slot) slot.parentElement.insertBefore(host, slot);
        }
    }

    /* The footer's column headings carry mobile Toggle buttons; on any
       screen they now fold their own list. */
    /* The source site's dropdowns are styled facades over invisible native
       selects, and the script that copied a choice onto the facade did not
       survive capture. The facade now mirrors the native value at load,
       which covers a preselected model, and on every change, which covers
       the person picking with the real control. */
    function wireSelectFacades() {
        $$('.custom-selectbox').forEach(function (box) {
            var select = box.querySelector('select');
            var label = box.querySelector('.selectedValue');
            if (!select || !label || box.__dpsFacade) return;
            box.__dpsFacade = true;
            function sync() {
                var option = select.selectedOptions && select.selectedOptions[0];
                if (option && option.textContent.trim()) label.textContent = option.textContent.trim();
            }
            select.addEventListener('change', sync);
            sync();
        });
    }

    function wireFooterToggles() {
        $$('footer h3, footer h2').forEach(function (head) {
            var btn = head.querySelector('button');
            var toggler = btn || (/^toggle /i.test((head.textContent || '').trim()) ? head : null);
            if (!toggler || toggler.__dps) return;
            var body = head.nextElementSibling;
            if (!body) return;
            toggler.__dps = true;
            toggler.setAttribute('data-dps-wired', '1');
            var link = head.querySelector('a');
            if (link) link.setAttribute('data-dps-wired', '1');
            toggler.addEventListener('click', function (e) {
                e.preventDefault();
                body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });
    }

    /* Whatever is still pressable and unwired after every pass above routes
       to the nearest real link in its own card, and a control with no
       destination at all leaves the stage rather than lying on it. */
    function wireRemainingControls() {
        $$('button, [role="button"]').forEach(function (b) {
            if (b.__dps || b.closest('#dengage-panel, #inbox, #test-drive, .dps-controls, #dps-debug, #dps-lightbox, form, header, .slick-slider')) return;
            if (b.hasAttribute('data-dps-wired') || b.hasAttribute('data-demo-dead') ||
                b.hasAttribute('data-open') || b.hasAttribute('data-close') ||
                b.hasAttribute('data-save-car')) return;
            var a = nearestHref(b);
            if (a) {
                b.__dps = true;
                b.setAttribute('data-dps-wired', '1');
                b.addEventListener('click', function (e) { e.preventDefault(); a.click(); });
            } else if (!(b.textContent || '').trim() && !b.querySelector('img')) {
                b.style.display = 'none';
            } else {
                b.__dps = true;
                b.setAttribute('data-dps-wired', '1');
                b.addEventListener('click', function (e) {
                    e.preventDefault();
                    toast(t('notPart'));
                });
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* The finance calculator page                                          */

    /* The source calculator is scripted upstream and arrives dead. This one
       works: the same inputs, plain arithmetic, clearly labelled as excluding
       any finance rate, because inventing an interest figure would put a
       number on screen that nobody quoted. Using it files a real
       finance-intent signal. */
    function wireFinance() {
        if (window.location.pathname.indexOf('finance-calculator') === -1) return;
        var host = $('#dps-finance');
        if (!host || !window.Catalog) return;
        var models = window.Catalog.all().filter(function (c) { return c.price; });
        host.innerHTML =
            '<label>Model<select id="fin-model">' + models.map(function (c) {
                return '<option value="' + c.id + '">' + c.nameEn + ', SAR ' + c.price.toLocaleString('en-US') + '</option>';
            }).join('') + '</select></label>' +
            '<label>Down payment (SAR)<input id="fin-down" type="number" min="0" step="1000" value="0"></label>' +
            '<label>Months<select id="fin-months"><option>24</option><option>36</option><option selected>48</option><option>60</option></select></label>' +
            '<div class="fin-out"><span>Indicative monthly amount</span><strong id="fin-monthly">...</strong>' +
            '<small>Vehicle price divided over the term, excluding any finance rate, insurance or fees. Your dealer quotes the real figure.</small></div>';
        var signalled = false;
        function calc(interaction) {
            var car = window.Catalog.get($('#fin-model').value);
            var down = Number($('#fin-down').value || 0);
            var months = Number($('#fin-months').value || 48);
            if (!car || !car.price || !months) return;
            var principal = Math.max(0, car.price - down);
            $('#fin-monthly').textContent = 'SAR ' + Math.round(principal / months).toLocaleString('en-US');
            /* One finance-intent signal per visit: the interest is the fact,
               not every keystroke. */
            if (interaction && !signalled) {
                signalled = true;
                signal('finance', true);
                window.DengageEvents.leadEvent('finance_intent', { model: car.id, source: 'website' });
            }
        }
        ['change', 'input'].forEach(function (evt) {
            host.addEventListener(evt, function () { calc(true); });
        });
        calc(false);
    }

    /* ------------------------------------------------------------------ */
    /* Small shared furniture                                               */

    var lightSet = [], lightAt = 0;
    function stepLightbox(d) {
        if (!lightSet.length) return;
        lightAt = (lightAt + d + lightSet.length) % lightSet.length;
        var lb = $('#dps-lightbox');
        if (lb) lb.querySelector('img').src = lightSet[lightAt];
    }
    function openLightbox(set, at) {
        if (!set.length) return;
        lightSet = set;
        lightAt = Math.max(0, at);
        var lb = $('#dps-lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'dps-lightbox';
            lb.innerHTML = '<button type="button" class="lb-x" aria-label="Close">&times;</button>' +
                '<button type="button" class="lb-prev" aria-label="Previous">&#8249;</button>' +
                '<img alt="">' +
                '<button type="button" class="lb-next" aria-label="Next">&#8250;</button>';
            document.body.appendChild(lb);
            lb.addEventListener('click', function (e) {
                if (e.target === lb || e.target.classList.contains('lb-x')) lb.classList.remove('open');
                else if (e.target.classList.contains('lb-prev')) stepLightbox(-1);
                else if (e.target.classList.contains('lb-next')) stepLightbox(1);
            });
            document.addEventListener('keydown', function (e) {
                if (!lb.classList.contains('open')) return;
                if (e.key === 'Escape') lb.classList.remove('open');
                if (e.key === 'ArrowRight') stepLightbox(1);
                if (e.key === 'ArrowLeft') stepLightbox(-1);
            });
        }
        stepLightbox(0);
        lb.classList.add('open');
    }

    function wireGallery() {
        document.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button, a') : null;
            if (!b) return;
            var aria = b.getAttribute('aria-label') || '';
            if (/gallery|fullscreen/i.test(aria) && b.closest('main')) {
                e.preventDefault();
                var scope = b.closest('section') || document;
                var seen = [];
                $$('img', scope).forEach(function (i) {
                    var s = i.currentSrc || i.src;
                    if (s && i.naturalWidth > 60 && seen.indexOf(s) === -1) seen.push(s);
                });
                var img = b.querySelector('img');
                openLightbox(seen, Math.max(0, seen.indexOf(img ? (img.currentSrc || img.src) : '')));
            }
        });
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

    /* The 17 shared popup creatives render in cross-origin iframes and ask the
       host page for its theme. Answer with this site's, so every one of them
       arrives dressed for it. */
    var THEME = {
        primary: '#111111', onPrimary: '#ffffff', accent: '#c3002f',
        ink: '#111111', muted: '#6e7275', surface: '#ffffff', page: '#f4f4f4',
        line: '#e3e3e3', tint: '#f4f4f4', radius: '2px',
        brandText: '#111111', shadow: '0 12px 32px rgba(0,0,0,.18)',
        displayFont: '"Nissan Brand", Arial, sans-serif',
        bodyFont: '"Nissan Brand", Arial, sans-serif'
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

    /* A static capture can carry the odd img whose source never existed on
       the CDN. A broken-image glyph reads as a fault, an absent one as
       design, so failures simply disappear. */
    function hideBrokenImages() {
        document.addEventListener('error', function (event) {
            var el = event.target;
            if (el && el.tagName === 'IMG') el.style.visibility = 'hidden';
        }, true);
        $$('img').forEach(function (img) {
            var src = img.getAttribute('src') || '';
            /* An SVG can legitimately report naturalWidth 0, so only raster
               sources are judged by it. */
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

        /* FIRST, before anything else on the page: the page view is the only
           thing that makes this demo's rows findable in the shared tables. */
        window.DengageEvents.pageview(
            document.body.getAttribute('data-page-type') || 'other', pageviewDetail());

        hideBrokenImages();
        answerThemeRequests();
        wireOverlays();
        wireHeader();
        wireCarousels();
        wireBookingForm();
        wireOtherLeadForms();
        wireSelectFacades();
        wireCtas();
        wireLabelledCtas();
        wirePriceWatch();
        wireFooterToggles();
        wireFinance();
        wireGallery();
        wireRemainingControls();
        paintHearts();

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
    /* js/creatives.js draws the on-site experiences and needs these four: the
       newsletter and arrival cards capture a lead, the survey and the rescue
       card each earn a message. Everything they call is the same path the
       site's own forms use. */
    window.Site = {
        cartLines: cartLines,
        saved: wishlist,
        toast: toast,
        mintIdentity: mintIdentity,
        relayLead: relayLead,
        confirmBooking: confirmBooking,
        abandonedBooking: abandonedBooking
    };

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
